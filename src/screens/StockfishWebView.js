// components/StockfishWebView.js
import React, { forwardRef, useImperativeHandle } from 'react';
import { WebView } from 'react-native-webview';

const StockfishWebView = forwardRef(({ onMessage, style }, ref) => {
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- In your HTML -->
  <script>
    // Try multiple CDNs for chess.js
    function loadChessJS() {
      return new Promise((resolve, reject) => {
        const chessCDNs = [
          'https://cdn.jsdelivr.net/npm/chess.js@0.13.4/chess.min.js',
          'https://unpkg.com/chess.js@0.13.4/chess.min.js',
          'https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.13.4/chess.min.js'
        ];
        
        let currentCDN = 0;
        
        function tryLoad() {
          if (currentCDN >= chessCDNs.length) {
            reject('All chess.js CDNs failed');
            return;
          }
          
          const script = document.createElement('script');
          script.src = chessCDNs[currentCDN];
          script.onload = () => {
            console.log('chess.js loaded from CDN', currentCDN + 1);
            resolve();
          };
          script.onerror = () => {
            currentCDN++;
            tryLoad();
          };
          document.head.appendChild(script);
        }
        
        tryLoad();
      });
    }
  </script>
</head>
<body>
  <div id="status" style="display:none;">Loading chess engine...</div>
  
  <script>
    let stockfish = null;
    let chess = null;
    let isEngineReady = false;
    let isChessReady = false;
    
    // Initialize both chess.js and Stockfish
    async function initEngines() {
      try {
        // First load chess.js
        await loadChessJS();
        chess = new Chess();
        isChessReady = true;
        
        console.log('chess.js loaded successfully');
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'chessjs_ready'
        }));
        
        // Then initialize Stockfish
        initStockfish();
        
      } catch (error) {
        console.error('Failed to load chess.js:', error);
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'error',
          data: 'Failed to load chess engine: ' + error
        }));
      }
    }
    
    // Initialize Stockfish
    function initStockfish() {
      try {
        const stockfishCDNs = [
          'https://cdn.jsdelivr.net/npm/stockfish-js@10.0.2/dist/stockfish.js',
          'https://unpkg.com/stockfish-js@10.0.2/dist/stockfish.js',
          'https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js'
        ];
        
        let currentCDN = 0;
        
        function tryLoadStockfish() {
          if (currentCDN >= stockfishCDNs.length) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'error',
              data: 'Failed to load Stockfish from all CDNs'
            }));
            return;
          }
          
          console.log('Trying Stockfish CDN', currentCDN + 1, ':', stockfishCDNs[currentCDN]);
          
          try {
            stockfish = new Worker(stockfishCDNs[currentCDN]);
            
            stockfish.onmessage = function(event) {
              const message = event.data;
              
              // Send message to React Native
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'stockfish_message',
                data: message
              }));
              
              if (message === 'uciok') {
                stockfish.postMessage('isready');
              } else if (message === 'readyok') {
                isEngineReady = true;
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'engine_ready',
                  data: 'Stockfish engine ready'
                }));
                console.log('Stockfish engine ready!');
              }
            };
            
            stockfish.onerror = function(error) {
              console.error('Stockfish CDN', currentCDN + 1, 'failed:', error);
              currentCDN++;
              tryLoadStockfish();
            };
            
            stockfish.postMessage('uci');
            
          } catch (error) {
            console.error('Failed to create Stockfish worker:', error);
            currentCDN++;
            tryLoadStockfish();
          }
        }
        
        tryLoadStockfish();
        
      } catch (error) {
        console.error('Stockfish init error:', error);
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'error',
          data: 'Stockfish initialization failed: ' + error.message
        }));
      }
    }
    
    // Clean PGN string - remove invalid characters and fix common issues
    function cleanPGN(pgnString) {
      if (!pgnString || typeof pgnString !== 'string') {
        return '';
      }
      
      // Remove extra whitespace and normalize line endings
      let cleaned = pgnString
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\t/g, ' ')
        .replace(/  +/g, ' ')
        .trim();
      
      // Remove move annotations like !, ?, !!, ??, !?, ?!
      cleaned = cleaned.replace(/[!?]{1,2}/g, '');
      
      // Remove comments in {}
      cleaned = cleaned.replace(/\{[^}]*\}/g, '');
      
      // Remove $N annotations (NAG codes)
      cleaned = cleaned.replace(/\$\d+/g, '');
      
      // Remove + (check) and # (checkmate) symbols
      cleaned = cleaned.replace(/[+#]/g, '');
      
      // Remove result markers
      cleaned = cleaned.replace(/\s*(1-0|0-1|1\/2-1\/2|\*)\s*$/, '');
      
      // Fix common OCR errors
      cleaned = cleaned
        .replace(/O-O-O/g, 'O-O-O') // Long castle
        .replace(/O-O/g, 'O-O')     // Short castle
        .replace(/0-0-0/g, 'O-O-O') // Fix 0 vs O
        .replace(/0-0/g, 'O-O')
        .replace(/e\.g\./gi, '')
        .replace(/i\.e\./gi, '')
        .replace(/\.\.\./g, ' ')
        .replace(/\./g, ' . ')
        .replace(/de/gi, ' ')
        .replace(/d3/gi, 'd3')
        .replace(/e4/gi, 'e4')
        .replace(/Nf3/gi, 'Nf3')
        .replace(/Nc3/gi, 'Nc3');
      
      // Remove everything that's not a valid move character
      cleaned = cleaned.replace(/[^a-hA-H0-8x+=KQRBN\-O\s\.]/g, ' ');
      
      // Fix spacing around dots
      cleaned = cleaned.replace(/\s*\.\s*/g, ' . ');
      
      // Remove extra spaces
      cleaned = cleaned.replace(/\s+/g, ' ').trim();
      
      return cleaned;
    }
    
    // Parse PGN string with validation
    function parsePGN(pgnString) {
      try {
        if (!chess || !isChessReady) {
          return {
            success: false,
            error: 'Chess engine not loaded'
          };
        }
        
        // Clean the PGN first
        const cleanedPGN = cleanPGN(pgnString);
        
        if (!cleanedPGN.trim()) {
          return {
            success: false,
            error: 'Empty PGN after cleaning'
          };
        }
        
        console.log('Cleaned PGN:', cleanedPGN.substring(0, 100) + '...');
        
        // Try to parse with chess.js
        chess.reset();
        
        // Check if it's just move text without headers
        let moveText = cleanedPGN;
        const lines = cleanedPGN.split('\\n');
        
        // Extract moves from PGN format
        const moveLines = [];
        let inMoves = false;
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          
          if (trimmed.startsWith('[')) {
            // PGN header, skip or parse if needed
            continue;
          } else if (trimmed.startsWith('1.')) {
            inMoves = true;
          }
          
          if (inMoves) {
            moveLines.push(trimmed);
          }
        }
        
        moveText = moveLines.join(' ');
        
        // If no move lines found, try the original cleaned text
        if (!moveText.trim()) {
          moveText = cleanedPGN;
        }
        
        // Further clean the move text
        moveText = moveText
          .replace(/\\d+\\.\\.\\./g, '')  // Remove black move numbers
          .replace(/\\d+\\./g, '')        // Remove white move numbers
          .replace(/\\s+/g, ' ')          // Normalize spaces
          .trim();
        
        console.log('Move text to parse:', moveText.substring(0, 100) + '...');
        
        // Try to load the PGN
        const loadResult = chess.load_pgn(moveText, { sloppy: true });
        
        if (loadResult) {
          const fen = chess.fen();
          const moves = chess.history();
          const turn = chess.turn();
          
          console.log('PGN parsed successfully. Moves:', moves.length);
          
          return {
            success: true,
            fen: fen,
            moves: moves,
            turn: turn,
            moveCount: moves.length,
            gameOver: chess.game_over(),
            inCheck: chess.in_check(),
            lastMove: moves.length > 0 ? moves[moves.length - 1] : null
          };
        } else {
          // Try alternative parsing for common move lists
          const moves = extractMovesFromText(moveText);
          
          if (moves.length > 0) {
            chess.reset();
            let validMoves = [];
            
            for (const move of moves) {
              try {
                const result = chess.move(move, { sloppy: true });
                if (result) {
                  validMoves.push(move);
                } else {
                  break;
                }
              } catch (moveError) {
                console.warn('Invalid move:', move, moveError);
                break;
              }
            }
            
            if (validMoves.length > 0) {
              return {
                success: true,
                fen: chess.fen(),
                moves: validMoves,
                turn: chess.turn(),
                moveCount: validMoves.length,
                gameOver: chess.game_over(),
                inCheck: chess.in_check(),
                lastMove: validMoves[validMoves.length - 1],
                note: 'Parsed using alternative method'
              };
            }
          }
          
          return {
            success: false,
            error: 'Invalid PGN format. Could not parse moves.',
            cleanedText: cleanedPGN.substring(0, 200)
          };
        }
        
      } catch (error) {
        console.error('PGN parsing error:', error);
        return {
          success: false,
          error: 'PGN parsing error: ' + error.message
        };
      }
    }
    
    // Extract moves from text using regex
    function extractMovesFromText(text) {
      const moves = [];
      
      // Common chess move patterns
      const movePatterns = [
        // Piece moves: Nf3, Bb5, Rxe4
        /([KQRBN]?[a-h]?[1-8]?x?[a-h][1-8])/g,
        // Pawn moves: e4, exd5, e8=Q
        /([a-h]x?[a-h][1-8](?:=[QRBN])?)/g,
        // Castling: O-O, O-O-O
        /(O-O(?:-O)?)/g
      ];
      
      // Split by common separators
      const tokens = text.split(/[\\s.,;]/).filter(t => t.trim());
      
      for (const token of tokens) {
        // Check if it looks like a chess move
        if (isChessMove(token)) {
          moves.push(token);
        }
      }
      
      return moves;
    }
    
    // Check if a string looks like a chess move
    function isChessMove(str) {
      if (!str || str.length < 2 || str.length > 7) return false;
      
      // Common chess move patterns
      const patterns = [
        /^[a-h][1-8]$/,                    // Pawn move: e4
        /^[a-h]x[a-h][1-8]$/,              // Pawn capture: exd5
        /^[a-h][1-8]=[QRBN]$/,             // Promotion: e8=Q
        /^[KQRBN][a-h]?[1-8]?[a-h][1-8]$/, // Piece move: Nf3
        /^[KQRBN][a-h]?[1-8]?x[a-h][1-8]$/,// Piece capture: Bxe5
        /^O-O$/,                           // Short castle
        /^O-O-O$/                          // Long castle
      ];
      
      return patterns.some(pattern => pattern.test(str));
    }
    
    // Analyze position with Stockfish
    function analyzePosition(fen, options = {}) {
      if (!isEngineReady || !stockfish) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'error',
          data: 'Stockfish engine not ready'
        }));
        return;
      }
      
      const depth = options.depth || 15;
      const multiPV = options.multiPV || 3;
      
      stockfish.postMessage('ucinewgame');
      stockfish.postMessage('position fen ' + fen);
      stockfish.postMessage('setoption name MultiPV value ' + multiPV);
      stockfish.postMessage('go depth ' + depth);
    }
    
    // Get position at specific move
    function getPositionAtMove(pgnString, moveIndex) {
      try {
        const parseResult = parsePGN(pgnString);
        
        if (!parseResult.success) {
          return null;
        }
        
        // Replay moves up to the specified index
        chess.reset();
        const moves = parseResult.moves || [];
        const targetIndex = moveIndex === -1 ? moves.length - 1 : Math.min(moveIndex, moves.length - 1);
        
        for (let i = 0; i <= targetIndex; i++) {
          chess.move(moves[i], { sloppy: true });
        }
        
        return {
          fen: chess.fen(),
          move: moves[targetIndex] || null,
          moveNumber: Math.floor(targetIndex / 2) + 1,
          sideToMove: chess.turn() === 'w' ? 'white' : 'black',
          totalMoves: moves.length,
          currentMoveIndex: targetIndex
        };
      } catch (error) {
        console.error('Error getting position:', error);
        return null;
      }
    }
    
    // Handle messages from React Native
    window.addEventListener('message', function(event) {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.action) {
          case 'parse_pgn':
            const pgnResult = parsePGN(data.pgn);
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'pgn_parsed',
              data: pgnResult
            }));
            break;
            
          case 'analyze_position':
            analyzePosition(data.fen, data.options || {});
            break;
            
          case 'get_position':
            const position = getPositionAtMove(data.pgn, data.moveIndex);
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'position_result',
              data: position
            }));
            break;
            
          case 'stop':
            if (stockfish) {
              stockfish.postMessage('stop');
            }
            break;
            
          case 'ping':
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'pong',
              data: {
                chessjs: isChessReady,
                stockfish: isEngineReady,
                timestamp: Date.now()
              }
            }));
            break;
            
          case 'test_pgn':
            // Test if a PGN can be parsed
            const testResult = parsePGN(data.pgn);
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'test_result',
              data: testResult
            }));
            break;
        }
      } catch (error) {
        console.error('Message handler error:', error);
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'error',
          data: 'Message handling error: ' + error.message
        }));
      }
    });
    
    // Send status update
    function sendStatus() {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'status',
        data: {
          chessjs: isChessReady,
          stockfish: isEngineReady,
          timestamp: Date.now()
        }
      }));
    }
    
    // Initialize on load
    window.addEventListener('load', function() {
      console.log('WebView loaded, initializing engines...');
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'webview_loaded',
        data: 'WebView initialized'
      }));
      
      // Start engine initialization
      initEngines();
      
      // Send periodic status updates
      setInterval(sendStatus, 5000);
    });
    
    // Global error handler
    window.onerror = function(message, source, lineno, colno, error) {
      console.error('Global error:', message, error);
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'error',
        data: 'WebView error: ' + (error?.message || message)
      }));
      return true;
    };
  </script>
</body>
</html>
`;

  const webViewRef = React.useRef(null);

  useImperativeHandle(ref, () => ({
    postMessage: (message) => {
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          (function() {
            try {
              window.postMessage(${JSON.stringify(message)});
            } catch(e) {
              console.error('Post message error:', e);
            }
          })();
        `);
      }
    },
    reload: () => {
      if (webViewRef.current) {
        webViewRef.current.reload();
      }
    }
  }));

  return (
    <WebView
      ref={webViewRef}
      source={{ html: htmlContent }}
      style={style}
      javaScriptEnabled={true}
      domStorageEnabled={true}
      onMessage={(event) => {
        try {
          const data = JSON.parse(event.nativeEvent.data);
          
          // Add timestamp to all messages
          data.timestamp = Date.now();
          
          if (onMessage) {
            onMessage(data);
          }
        } catch (error) {
          console.error('Failed to parse WebView message:', error, event.nativeEvent.data);
          if (onMessage) {
            onMessage({
              type: 'error',
              data: 'Failed to parse message: ' + error.message,
              timestamp: Date.now()
            });
          }
        }
      }}
      onError={(error) => {
        console.error('WebView error:', error);
        if (onMessage) {
          onMessage({
            type: 'error',
            data: 'WebView loading error',
            timestamp: Date.now()
          });
        }
      }}
      onLoadEnd={() => {
        console.log('WebView loaded successfully');
      }}
    />
  );
});

export default StockfishWebView;