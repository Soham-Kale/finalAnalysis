import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Button, ActivityIndicator } from 'react-native';
import Stockfish from 'stockfish';
import { Chess } from 'chess.js';

const StockfishAnalyzer = () => {
  const [engine, setEngine] = useState(null);
  const [position, setPosition] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const [evaluation, setEvaluation] = useState(null);
  const [bestMove, setBestMove] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const chess = useRef(new Chess());

  useEffect(() => {
    // Initialize Stockfish engine
    const engine = new Stockfish();
    setEngine(engine);

    engine.onmessage = (line) => {
      console.log('Engine:', line);
      
      // Parse best move
      if (line.startsWith('bestmove')) {
        const move = line.split(' ')[1];
        setBestMove(move);
        setIsAnalyzing(false);
      }
      
      // Parse evaluation
      if (line.includes('score cp')) {
        const parts = line.split(' ');
        const cpIndex = parts.indexOf('score');
        if (cpIndex !== -1) {
          const score = parseInt(parts[cpIndex + 2]) / 100; // Convert to pawns
          const evalType = parts[cpIndex + 1]; // 'cp' or 'mate'
          setEvaluation({ score, type: evalType });
        }
      }
    };

    // Initialize UCI protocol
    engine.postMessage('uci');
    engine.postMessage('setoption name Skill Level value 20');
    engine.postMessage('isready');

    return () => {
      engine.postMessage('quit');
    };
  }, []);

  const analyzePosition = () => {
    if (!engine) return;
    
    setIsAnalyzing(true);
    setBestMove('');
    
    // Set position and analyze
    engine.postMessage(`position fen ${position}`);
    engine.postMessage('go depth 18'); // Higher depth = stronger analysis
  };

  const analyzePGN = (pgnString) => {
    if (!engine) return;
    
    setIsAnalyzing(true);
    
    // Reset chess board
    chess.current.loadPgn(pgnString);
    const fen = chess.current.fen();
    
    // Send position to engine
    engine.postMessage(`position fen ${fen}`);
    engine.postMessage('go depth 20');
  };

  const analyzePGNFile = async (pgnContent) => {
    // Split PGN into moves and analyze each position
    const moves = pgnContent.match(/\d+\.\s+(\S+)/g) || [];
    const analysis = [];
    
    chess.current.reset();
    
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i].split(/\d+\.\s+/)[1];
      
      try {
        chess.current.move(move);
        const fen = chess.current.fen();
        
        // Analyze this position
        await new Promise((resolve) => {
          engine.postMessage(`position fen ${fen}`);
          engine.postMessage('go depth 15 movetime 1000');
          
          const handler = (line) => {
            if (line.startsWith('bestmove')) {
              const bestMove = line.split(' ')[1];
              analysis.push({
                ply: i + 1,
                move: move,
                fen: fen,
                bestMove: bestMove
              });
              resolve();
            }
          };
          
          engine.onmessage = handler;
        });
      } catch (e) {
        console.log('Invalid move:', move);
      }
    }
    
    return analysis;
  };

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 18, marginBottom: 10 }}>Stockfish Analysis</Text>
      
      <Button
        title="Analyze Current Position"
        onPress={analyzePosition}
        disabled={isAnalyzing}
      />
      
      {isAnalyzing && <ActivityIndicator size="large" style={{ marginTop: 20 }} />}
      
      {evaluation && (
        <View style={{ marginTop: 20 }}>
          <Text>Evaluation: {evaluation.score} pawns</Text>
          <Text>Type: {evaluation.type}</Text>
        </View>
      )}
      
      {bestMove && (
        <View style={{ marginTop: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>Best Move: {bestMove}</Text>
        </View>
      )}
    </View>
  );
};

export default StockfishAnalyzer;