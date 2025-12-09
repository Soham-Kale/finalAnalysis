export const getStockfishHtml = () => ` 
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stockfish Worker</title>
  <script>
    let stockfish;
    const STOCKFISH_URL = 'https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js';

    // ✅ NEW: helper to parse "info" lines from Stockfish
    function parseInfoLine(data) {
      if (typeof data !== 'string') return null;
      if (!data.startsWith('info ')) return null;

      const tokens = data.trim().split(/\\s+/);
      const scoreIndex = tokens.indexOf('score');
      if (scoreIndex === -1 || scoreIndex + 2 >= tokens.length) return null;

      const scoreType = tokens[scoreIndex + 1];   // 'cp' or 'mate'
      const scoreValue = parseInt(tokens[scoreIndex + 2], 10);

      const pvIndex = tokens.indexOf('pv');
      const pvMoves = pvIndex !== -1 ? tokens.slice(pvIndex + 1) : [];

      return {
        scoreType,   // 'cp' | 'mate'
        scoreValue,  // number
        pvMoves      // array of UCI moves: ['e2e4','e7e5',...]
      };
    }

    async function initStockfish() {
      try {
        console.log('Fetching Stockfish from:', STOCKFISH_URL);
        const response = await fetch(STOCKFISH_URL);
        if (!response.ok) throw new Error('Failed to fetch stockfish.js: ' + response.statusText);
        
        const scriptContent = await response.text();
        const blob = new Blob([scriptContent], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);

        stockfish = new Worker(workerUrl);
        
        stockfish.onerror = function(e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'error',
            message: 'Worker Error: ' + (e.message || String(e))
          }));
        };
        
        stockfish.onmessage = function(event) {
          const data = event.data;

          // (Optional) raw debug:
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'debug',
            message: 'SF: ' + data
          }));

          // ✅ NEW: parse "info" lines for eval + PV
          const parsedInfo = parseInfoLine(data);
          if (parsedInfo) {
            const { scoreType, scoreValue, pvMoves, multipv, depth } = parsedInfo;

            let evalCp = null;
            let mateIn = null;

            if (scoreType === 'cp') {
              evalCp = scoreValue;      // centipawns from side-to-move POV
            } else if (scoreType === 'mate') {
              mateIn = scoreValue;      // mate in N (positive: you mate, negative: you get mated)
            }

            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'analysis_update',   // 🔹 continuous updates while thinking
              data: {
                evalCp,                 // e.g. 34 = +0.34
                mateIn,                 // e.g. 3 = mate in 3
                pv: pvMoves,            // ['e2e4','e7e5','g1f3',...]
                multipv,                // 1, 2, 3...
                depth,
                raw: data               // full raw line if you want
              }
            }));
          }

          if (data === 'readyok') {
            console.log('Stockfish engine ready');
            document.getElementById('status').innerText = 'Engine Ready';
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'engine_ready'
            }));
          }

          // ✅ Your existing bestmove handling (kept)
          if (typeof data === 'string' && data.startsWith('bestmove')) {
            const match = data.match(/bestmove\\s+(\\S+)/);
            if (match) {
              const bestMove = match[1];
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'analysis_result',   // 🔹 final result for this search
                data: {
                  bestMove: bestMove,
                  raw: data
                }
              }));
            }
          }
        };

        stockfish.postMessage('uci');
        stockfish.postMessage('isready');

      } catch (e) {
        console.error('Stockfish Init Error:', e);
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'error',
          message: 'Init failed: ' + e.message
        }));
      }
    }

    // Handle messages from React Native
    document.addEventListener('message', function(event) {
      handleRNMessage(event);
    });
    
    window.addEventListener('message', function(event) {
      if (event.data && typeof event.data === 'string') {
        try {
          JSON.parse(event.data);
          handleRNMessage(event);
        } catch(e) {
          // ignore non-json
        }
      }
    });

    function handleRNMessage(event) {
      try {
        const message = JSON.parse(event.data);
        console.log('Message from RN:', message);

        if (!stockfish) return;

        if (message.type === 'analyze') {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'debug',
            message: 'Starting analysis for FEN: ' + message.fen
          }));
          
          stockfish.postMessage('stop');
          // Wait a tiny bit or just send subsequent commands? UCI queues them.
          stockfish.postMessage('setoption name MultiPV value 3');
          stockfish.postMessage('setoption name Ponder value false'); 
          stockfish.postMessage('position fen ' + message.fen);
          stockfish.postMessage('go depth ' + (message.depth || 15));
        } else if (message.type === 'stop_analysis') {
          stockfish.postMessage('stop');
        }
      } catch (e) {
        console.error('Error processing message:', e);
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'error',
          message: 'Message processing error: ' + e.message
        }));
      }
    }

    // Start initialization
    initStockfish();
  </script>
</head>
<body>
  <div id="status">Initializing Stockfish...</div>
</body>
</html>
`;
