import { useState, useCallback, useRef } from 'react';
import { parsePGNToPositions } from '../utils/pgnParser';

const useStockfishAnalysis = (webViewRef) => {
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]); // Add logs state
  const currentAnalysis = useRef(null);

  const addLog = (msg) => {
    setLogs(prev => [...prev.slice(-19), msg]); // Keep last 20 logs
  };

  // Simple UCI info parser (focuses on depth, score, PV for top moves)
  const parseInfo = useCallback((line) => {
    // Regex for: info depth D [multipv N] score TYPE VALUE [nodes N] pv MOVE1 [MOVE2 ...]
    const match = line.match(
      /info\s+depth\s+(\d+)\s+(multipv\s+(\d+)\s+)?score\s+(cp|mate)\s+([\d-]+)(?:\s+nodes\s+(\d+))?\s+pv\s+(.+)/i
    );
    if (!match) return null;

    const depth = parseInt(match[1], 10);
    const multipv = match[3] ? parseInt(match[3], 10) : 1;
    const scoreType = match[4];
    let scoreValue = parseInt(match[5], 10);
    const nodes = match[6] ? parseInt(match[6], 10) : 0;
    const pvMoves = match[7].trim().split(/\s+/);

    // Convert score: centipawns to pawns, mate as extreme value
    let score;
    if (scoreType === 'cp') {
      score = scoreValue / 100;
    } else if (scoreType === 'mate') {
      score = scoreValue > 0 ? 99 : -99; // Simplified mate handling
    } else {
      score = 0;
    }

    return {
      depth,
      multipv,
      score,
      nodes,
      pv: pvMoves, // Full PV array, but we use pv[0] for move
    };
  }, []);

  const handleMessage = useCallback(
    (event) => {
      try {
        const dataStr = event.nativeEvent.data;
        let data;
        try {
            data = JSON.parse(dataStr);
        } catch (e) {
            addLog('JSON Parse Error: ' + dataStr);
            return;
        }

        if (data.type === 'log') {
            addLog('LOG: ' + data.message);
            return;
        }
        
        if (data.type === 'response') {
            addLog('RESP: ' + data.line);
            return;
        }

        if (data.type !== 'engine_line') return;

        const line = data.line;
        // addLog('ENG: ' + line); // Verbose engine logs

        const ctx = currentAnalysis.current;
        if (!ctx) return;

        if (line.startsWith('info')) {
          const info = parseInfo(line);
          if (info) {
            ctx.infos.push(info);
          }
        } else if (line.startsWith('bestmove')) {
          const match = line.match(/bestmove\s+(\S+)/i);
          const bestMove = match ? match[1] : null;

          const { options = {}, fen, moveNumber, san, infos, resolve } = ctx;
          const depth = options.depth || 15;
          const multiPv = options.multiPv || 3;

          // Filter for near-max depth infos
          const relevantInfos = infos.filter((i) => i.depth >= depth - 2);
          const sortedInfos = relevantInfos.sort((a, b) => b.score - a.score);

          const topMoves = sortedInfos.slice(0, multiPv).map((info) => ({
            move: info.pv[0],
            score: info.score,
          }));

          const evaluation = topMoves[0]?.score || 0;

          const result = {
            bestMove,
            evaluation,
            depth,
            topMoves,
            movesAnalyzed: infos.length,
            currentFen: fen,
            moveNumber,
            san,
          };

          setAnalysis(result);
          setIsAnalyzing(false);
          currentAnalysis.current = null;
          resolve(result);
        }
      } catch (e) {
        setError(e.message);
        addLog('ERR: ' + e.message);
        if (currentAnalysis.current) {
          currentAnalysis.current.reject(e);
          currentAnalysis.current = null;
          setIsAnalyzing(false);
        }
      }
    },
    [parseInfo]
  );

  const analyze = useCallback(
    (pgn, options = {}) => {
      return new Promise((resolve, reject) => {
        setError(null);
        setIsAnalyzing(true);
        setAnalysis(null);
        addLog('Starting analysis...');

        const parseResult = parsePGNToPositions(pgn);
        if (!parseResult.valid) {
          const err = new Error(parseResult.error);
          setError(err.message);
          setIsAnalyzing(false);
          addLog('PGN Error: ' + err.message);
          reject(err);
          return;
        }

        const { positions } = parseResult;
        let index = options.moveIndex ?? positions.length - 1;
        if (index < 0) index = positions.length + index;
        
        const position = positions[index];
        if (!position) {
          const err = new Error('Invalid move index');
          setError(err.message);
          setIsAnalyzing(false);
          addLog('Index Error');
          reject(err);
          return;
        }

        const { fen, moveNumber, san } = position;
        addLog(`Analyzing move ${moveNumber} (${san})`);

        if (!webViewRef.current) {
          const err = new Error('WebView not ready');
          setError(err.message);
          setIsAnalyzing(false);
          addLog('WebView not ready');
          reject(err);
          return;
        }

        currentAnalysis.current = {
          options,
          fen,
          moveNumber,
          san,
          infos: [],
          resolve,
          reject,
        };

        const ctx = currentAnalysis.current;
        webViewRef.current.postMessage(
          JSON.stringify({ type: 'command', command: `position fen ${fen}` })
        );
        webViewRef.current.postMessage(
          JSON.stringify({
            type: 'command',
            command: `go multipv ${options.multiPv || 3} depth ${options.depth || 15}`,
          })
        );
        addLog('Commands sent');
      });
    },
    [webViewRef]
  );

  return { analyze, analysis, isAnalyzing, error, handleMessage, logs }; // Return logs
};

export default useStockfishAnalysis;