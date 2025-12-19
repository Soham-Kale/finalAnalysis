import React, { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
import { Chess } from 'chess.js';

const PGNViewer = forwardRef((props, ref) => {
  const {
    pgnString = "",
    onMove = null, // Callback when move changes: (fen) => void
    boardSize = SCREEN_WIDTH // Default to full width if not provided
  } = props;

  const autoplayRef = useRef(null);
  const webViewRef = useRef(null);
  const [moveIndex, setMoveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [webViewLoaded, setWebViewLoaded] = useState(false);

  const { fens, moves } = useMemo(() => {
    const chess = new Chess();
    const safe = (pgnString || '').trim();
    try {
      chess.loadPgn(safe);
    } catch {
      // If loadPgn fails, it might be an empty string or invalid PGN.
    }

    const verbose = chess.history({ verbose: true }) || [];
    const c2 = new Chess(); // Use a fresh Chess instance to build FENs from scratch
    const outFens = [c2.fen()]; // Always start with the initial FEN
    const outMoves = [null]; // The "move" to reach the initial FEN is null

    for (const mv of verbose) {
      c2.move(mv);
      outFens.push(c2.fen());
      outMoves.push(mv);
    }
    return { fens: outFens, moves: outMoves };
  }, [pgnString]);

  const totalPlies = fens.length - 1; 

  useEffect(() => {
    stopAutoplay();
    setMoveIndex(0);
    setIsPlaying(false);
  }, [pgnString]);

  useEffect(() => {
    if (webViewLoaded && webViewRef.current && fens[moveIndex]) {
      const lastMove = moveIndex > 0 ? moves[moveIndex] : null;
      const nextMove = (moveIndex + 1) < moves.length ? moves[moveIndex + 1] : null;
      
      updateBoardPosition(fens[moveIndex], lastMove, nextMove);
      
      if (onMove) {
          onMove(fens[moveIndex], moveIndex);
      }
    }
  }, [moveIndex, webViewLoaded, fens, moves]);

  useEffect(() => {
    if (!isPlaying || !webViewLoaded) return;
    const playNextMove = () => {
      if (moveIndex >= totalPlies) {
        setIsPlaying(false);
        return;
      }
      setMoveIndex(prev => prev + 1);
      if (isPlaying && moveIndex + 1 < totalPlies) {
        autoplayRef.current = setTimeout(playNextMove, 1000);
      }
    };
    autoplayRef.current = setTimeout(playNextMove, 1000);
    return () => clearTimeout(autoplayRef.current);
  }, [isPlaying, webViewLoaded, moveIndex, totalPlies]);

  const stopAutoplay = () => {
    if (autoplayRef.current) clearTimeout(autoplayRef.current);
    setIsPlaying(false);
  };

  const goToStart = () => { stopAutoplay(); setMoveIndex(0); };
  const goToPrevious = () => { stopAutoplay(); setMoveIndex(prev => Math.max(0, prev - 1)); };
  const goToNext = () => { stopAutoplay(); setMoveIndex(prev => Math.min(totalPlies, prev + 1)); };
  const goToEnd = () => { stopAutoplay(); setMoveIndex(totalPlies); };

  const handlePlayPause = () => {
    if (moveIndex >= totalPlies) {
      setMoveIndex(0);
      setTimeout(() => setIsPlaying(true), 50);
    } else {
      setIsPlaying(prev => !prev);
    }
  };

  useImperativeHandle(ref, () => ({
      goToStart,
      goToPrevious,
      goToNext,
      goToEnd,
      handlePlayPause,
      get isPlaying() { return isPlaying; }
  }));

  const updateBoardPosition = (fen, lastMove, nextMove) => {
    if (webViewRef.current) {
      const script = `
        if (typeof updatePosition === 'function') {
            updatePosition(
                ${JSON.stringify(fen)}, 
                ${JSON.stringify(lastMove)}, 
                ${JSON.stringify(nextMove)}
            );
        }
        true;
      `;
      webViewRef.current.injectJavaScript(script);
    }
  };

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
        <style>
            body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background-color: #262421; display: flex; justify-content: center; align-items: center; }
            #board { width: 100%; height: 100%; display: grid; grid-template-columns: repeat(8, 1fr); grid-template-rows: repeat(8, 1fr); }
            .square { display: flex; justify-content: center; align-items: center; position: relative; }
            .white { background-color: #f0d9b5; } /* Brown Light */
            .black { background-color: #b58863; } /* Brown Dark */
            .piece { width: 100%; height: 100%; background-size: cover; z-index: 2; pointer-events: none; }
            .highlight { box-shadow: inset 0 0 0 4px rgba(255, 255, 0, 0.5); }
            .coord { position: absolute; font-size: 10px; font-weight: bold; pointer-events: none; }
            .coord-rank { top: 2px; left: 2px; }
            .coord-file { bottom: 0px; right: 2px; }
            .square.black .coord { color: #ebecd0; }
            #arrow-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10; }
        </style>
    </head>
    <body>
        <div id="board"></div>
        <svg id="arrow-layer" viewBox="0 0 100 100">
            <defs>
                <marker id="arrowhead" markerWidth="6" markerHeight="7" refX="0" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">
                    <polygon points="0 0, 6 3.5, 0 7" fill="#46c3f2" opacity="0.9" />
                </marker>
            </defs>
            <g id="arrows-g"></g>
        </svg>
        <script>
            const pieceImages = {
                'wK': 'https://lichess1.org/assets/_Qyw6Qk/piece/cburnett/wK.svg',
                'wQ': 'https://lichess1.org/assets/_Qyw6Qk/piece/cburnett/wQ.svg',
                'wR': 'https://lichess1.org/assets/_Qyw6Qk/piece/cburnett/wR.svg',
                'wB': 'https://lichess1.org/assets/_Qyw6Qk/piece/cburnett/wB.svg',
                'wN': 'https://lichess1.org/assets/_Qyw6Qk/piece/cburnett/wN.svg',
                'wP': 'https://lichess1.org/assets/_Qyw6Qk/piece/cburnett/wP.svg',
                'bK': 'https://lichess1.org/assets/_Qyw6Qk/piece/cburnett/bK.svg',
                'bQ': 'https://lichess1.org/assets/_Qyw6Qk/piece/cburnett/bQ.svg',
                'bR': 'https://lichess1.org/assets/_Qyw6Qk/piece/cburnett/bR.svg',
                'bB': 'https://lichess1.org/assets/_Qyw6Qk/piece/cburnett/bB.svg',
                'bN': 'https://lichess1.org/assets/_Qyw6Qk/piece/cburnett/bN.svg',
                'bP': 'https://lichess1.org/assets/_Qyw6Qk/piece/cburnett/bP.svg'
            };

            function getSquareDetails(sq) {
                // sq is 'e2'
                const file = sq.charCodeAt(0) - 97; // 0-7
                const rank = 8 - parseInt(sq[1]);   // 0-7 (row 0 is rank 8)
                // Center of square in %
                const x = (file * 12.5) + 6.25;
                const y = (rank * 12.5) + 6.25;
                return { x, y };
            }

            function drawArrows(arrows) {
                const group = document.getElementById('arrows-g');
                if (!group) return;
                group.innerHTML = ''; 

                if (!arrows || !Array.isArray(arrows)) return;

                arrows.forEach(arrow => {
                    const start = getSquareDetails(arrow.from);
                    const end = getSquareDetails(arrow.to); 
                    
                    // Calculate vector
                    const dx = end.x - start.x;
                    const dy = end.y - start.y;
                    const len = Math.sqrt(dx * dx + dy * dy);
                    
                    // Shorten line by head length (6 units)
                    const headLength = 6; 
                    const shortLen = Math.max(0, len - headLength);
                    const ratio = len > 0 ? (shortLen / len) : 0;
                    
                    const shortEnd = {
                        x: start.x + dx * ratio,
                        y: start.y + dy * ratio
                    };

                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('x1', start.x);
                    line.setAttribute('y1', start.y);
                    line.setAttribute('x2', shortEnd.x);
                    line.setAttribute('y2', shortEnd.y);
                    line.setAttribute('stroke', arrow.color || '#46c3f2');
                    line.setAttribute('stroke-width', '3.2'); 
                    line.setAttribute('opacity', '0.9');
                    line.setAttribute('marker-end', 'url(#arrowhead)');
                    
                    if (arrow.color) {
                      line.setAttribute('stroke', arrow.color);
                    }
                    group.appendChild(line);
                });
            }

            function initBoard() {
                const board = document.getElementById('board');
                board.innerHTML = '';
                for (let row = 0; row < 8; row++) {
                    for (let col = 0; col < 8; col++) {
                        const square = document.createElement('div');
                        const isWhite = (row + col) % 2 === 0;
                        square.className = 'square ' + (isWhite ? 'white' : 'black');
                        square.id = 'sq-' + col + '-' + row;
                        
                        if (col === 0) {
                            const rank = document.createElement('div');
                            rank.className = 'coord coord-rank';
                            rank.innerText = (8 - row);
                            square.appendChild(rank);
                        }
                        
                        if (row === 7) {
                            const file = document.createElement('div');
                            file.className = 'coord coord-file';
                            file.innerText = String.fromCharCode(97 + col);
                            square.appendChild(file);
                        }

                        board.appendChild(square);
                    }
                }
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'webViewLoaded' }));
            }
            function updatePosition(fen, lastMove, nextMove) {
                const board = document.getElementById('board');
                
                // Clear all existing pieces first
                document.querySelectorAll('.piece').forEach(el => el.remove());

                // Parse FEN and update pieces
                // Simple parser since we just place images
                const rows = fen.split(' ')[0].split('/');
                rows.forEach((rowStr, rowIndex) => {
                    let colIndex = 0;
                    for (let i = 0; i < rowStr.length; i++) {
                        const char = rowStr[i];
                        if (!isNaN(char)) {
                            colIndex += parseInt(char);
                        } else {
                            const square = document.getElementById('sq-' + colIndex + '-' + rowIndex);
                            if (square) {
                                // Clear existing piece (redundant if all cleared at start, but good for robustness)
                                const existing = square.querySelector('.piece');
                                if (existing) existing.remove();
                                
                                const color = (char === char.toUpperCase()) ? 'w' : 'b';
                                const type = char.toUpperCase();
                                const pieceCode = color + type; // wK, bQ etc
                                
                                if (pieceImages[pieceCode]) {
                                    const img = document.createElement('div');
                                    img.className = 'piece';
                                    img.style.backgroundImage = 'url(' + pieceImages[pieceCode] + ')';
                                    square.appendChild(img);
                                }
                            }
                            colIndex++;
                        }
                    }
                });
                
                // Clear previous highlights
                document.querySelectorAll('.highlight').forEach(el => el.classList.remove('highlight'));
                
                // Highlight Last Move
                if (lastMove) {
                    const fromSq = document.getElementById('sq-' + (lastMove.from.charCodeAt(0) - 97) + '-' + (8 - parseInt(lastMove.from[1])));
                    const toSq = document.getElementById('sq-' + (lastMove.to.charCodeAt(0) - 97) + '-' + (8 - parseInt(lastMove.to[1])));
                    if (fromSq) fromSq.classList.add('highlight');
                    if (toSq) toSq.classList.add('highlight');
                }
                
                // Draw Arrow for Next Move (User Request: "before take move")
                if (nextMove) {
                  drawArrows([{ from: nextMove.from, to: nextMove.to, color: '#46c3f2' }]); 
                } else {
                  drawArrows([]);
                }
            }
            window.onload = initBoard;
        </script>
    </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <View style={[styles.chessboardContainer, { width: boardSize, height: boardSize }]}>
        <WebView
            ref={webViewRef}
            originWhitelist={['*']}
            source={{ html: htmlContent }}
            style={styles.webview}
            javaScriptEnabled={true}
            scrollEnabled={false}
            onMessage={(e) => {
                try {
                    const data = JSON.parse(e.nativeEvent.data);
                    if (data.type === 'webViewLoaded') {
                        setWebViewLoaded(true);
                        updateBoardPosition(fens[moveIndex], moves[moveIndex]);
                    }
                } catch(err){}
            }}
        />
        {!webViewLoaded && (
            <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        )}
      </View>
    </View>
  );
});

export default PGNViewer;

const styles = StyleSheet.create({
  container: {
      flexDirection: 'column',
      alignItems: 'center',
      backgroundColor: '#262421',
  },
  chessboardContainer: {
      backgroundColor: '#000',
  },
  webview: {
      flex: 1,
      backgroundColor: 'transparent',
  },
  loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#262421',
  }
});
