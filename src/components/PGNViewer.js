import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Dimensions, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native';
// import { useTheme } from '@react-navigation/native'; // Assume navigation is set up

const { width: SCREEN_WIDTH } = Dimensions.get('window');
import { Chess } from 'chess.js';

const BUTTON_SIZE = SCREEN_WIDTH * 0.13;
const ICON_SIZE = SCREEN_WIDTH * 0.06;

export default function PGNViewer({
  pgnString = "",
  onMove = null, // Callback when move changes: (fen) => void
  viewOnly = false,
  boardSize = SCREEN_WIDTH // Default to full width if not provided
}) {
  // const { colors } = useTheme();
  // Mock colors if useTheme not available, or just hardcode for now to match dark theme requested
  const colors = { background: '#262421', text: '#fff' };

  const autoplayRef = useRef(null);
  const webViewRef = useRef(null);
  const [moveIndex, setMoveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [webViewLoaded, setWebViewLoaded] = useState(false);

  const { fens, moves } = useMemo(() => {
    const chess = new Chess();
    const safe = pgnString || '';
    try {
      chess.loadPgn(safe);
    } catch {
      chess.load(safe); // try loading as FEN? No, loadPgn is specific.
      // If failed, maybe it's just a new game
    }

    const verbose = chess.history({ verbose: true }) || [];
    const c2 = new Chess();
    const outFens = [c2.fen()];
    const outMoves = [null];
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
    // setWebViewLoaded(false); // Don't reset loaded state, just update position
  }, [pgnString]);

  useEffect(() => {
    if (webViewLoaded && webViewRef.current && fens[moveIndex]) {
      updateBoardPosition(fens[moveIndex], moves[moveIndex]);
      if (onMove) {
          onMove(fens[moveIndex]);
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

  const updateBoardPosition = (fen, move) => {
    if (webViewRef.current) {
      const script = `
        if (typeof updatePosition === 'function') {
            updatePosition(${JSON.stringify(fen)}, ${JSON.stringify(move)});
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
            .white { background-color: #ebecd0; } /* Lichess light */
            .black { background-color: #739552; } /* Lichess dark */
            .piece { width: 100%; height: 100%; background-size: cover; z-index: 2; pointer-events: none; }
            .highlight { box-shadow: inset 0 0 0 4px rgba(255, 255, 0, 0.5); }
            .coord { position: absolute; font-size: 10px; font-weight: bold; pointer-events: none; }
            .coord-rank { top: 2px; left: 2px; }
            .coord-file { bottom: 0px; right: 2px; }
            .square.white .coord { color: #739552; }
            .square.black .coord { color: #ebecd0; }
        </style>
    </head>
    <body>
        <div id="board"></div>
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
            function initBoard() {
                const board = document.getElementById('board');
                board.innerHTML = '';
                for (let row = 0; row < 8; row++) {
                    for (let col = 0; col < 8; col++) {
                        const square = document.createElement('div');
                        const isWhite = (row + col) % 2 === 0;
                        square.className = 'square ' + (isWhite ? 'white' : 'black');
                        square.id = 'sq-' + col + '-' + row;
                        
                        // Add Ranks (on left column, i.e., col 0)
                        if (col === 0) {
                            const rank = document.createElement('div');
                            rank.className = 'coord coord-rank';
                            rank.innerText = (8 - row);
                            square.appendChild(rank);
                        }
                        
                        // Add Files (on bottom row, i.e., row 7)
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
            function updatePosition(fen, move) {
                const rows = fen.split(' ')[0].split('/');
                document.querySelectorAll('.piece').forEach(el => el.remove());
                document.querySelectorAll('.square').forEach(el => el.classList.remove('highlight'));
                
                rows.forEach((rowStr, rowIndex) => {
                    let colIndex = 0;
                    for (const char of rowStr) {
                        if (isNaN(char)) {
                            const sq = document.getElementById('sq-' + colIndex + '-' + rowIndex);
                            if (sq) {
                                const p = document.createElement('div');
                                p.className = 'piece';
                                const color = char === char.toUpperCase() ? 'w' : 'b';
                                p.style.backgroundImage = 'url(' + pieceImages[color + char.toUpperCase()] + ')';
                                sq.appendChild(p);
                            }
                            colIndex++;
                        } else {
                            colIndex += parseInt(char);
                        }
                    }
                });

                if (move) {
                    const fromCol = move.from.charCodeAt(0) - 97; // 'a' -> 0
                    const fromRow = 8 - parseInt(move.from[1]);   // '8' -> 0, '1' -> 7
                    const toCol = move.to.charCodeAt(0) - 97;
                    const toRow = 8 - parseInt(move.to[1]);
                    
                    const fromSq = document.getElementById('sq-' + fromCol + '-' + fromRow);
                    const toSq = document.getElementById('sq-' + toCol + '-' + toRow);
                    
                    if (fromSq) fromSq.classList.add('highlight');
                    if (toSq) toSq.classList.add('highlight');
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

      {/* Controls */}
      <View style={styles.controls}>
          <TouchableOpacity onPress={goToStart} style={styles.btn}><Text style={styles.btnText}>|&lt;</Text></TouchableOpacity>
          <TouchableOpacity onPress={goToPrevious} style={styles.btn}><Text style={styles.btnText}>&lt;</Text></TouchableOpacity>
          <TouchableOpacity onPress={handlePlayPause} style={styles.btn}><Text style={styles.btnText}>{isPlaying ? '||' : '>'}</Text></TouchableOpacity>
          <TouchableOpacity onPress={goToNext} style={styles.btn}><Text style={styles.btnText}>&gt;</Text></TouchableOpacity>
          <TouchableOpacity onPress={goToEnd} style={styles.btn}><Text style={styles.btnText}>&gt;|</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
      flexDirection: 'column',
      alignItems: 'center',
      backgroundColor: '#262421',
      // width: '90%',
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
  },
  controls: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      width: '100%',
      padding: 10,
      backgroundColor: '#262421',
  },
  btn: {
      padding: 10,
      backgroundColor: '#302e2c',
      borderRadius: 5,
      minWidth: 40,
      alignItems: 'center',
  },
  btnText: {
      color: '#bababa',
      fontSize: 18,
      fontWeight: 'bold',
  }
});
