import React, { useState, useRef, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import useStockfishAnalysis from '../hooks/useStockfishAnalysis';
import { getStockfishHtml } from '../utils/stockfishHtml';
import PGNViewer from '../components/PGNViewer';
import EvaluationBar from '../components/EvaluationBar';
import MoveList from '../components/MoveList';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ChessAnalysisScreen = () => {
  // Default PGN to start position or user prompt
  const [pgn, setPgn] = useState(''); 
  const [depth, setDepth] = useState(15);
  const [activeTab, setActiveTab] = useState('Analysis');
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);

  const stockfishWebViewRef = useRef(null);

  const {
    analyzeFen,
    liveAnalysis,
    engineReady,
    handleMessage
  } = useStockfishAnalysis(stockfishWebViewRef);

  // Layout constants
  const EVAL_BAR_WIDTH = 24;
  const GAP = 8; // Margin between bar and board
  const PADDING = 10; // Screen padding
  // Available width for board = Screen - Bar - Gap - Padding*2 (if centered) or just Padding
  // Actually style uses paddingHorizontal: 10.
  const TOTAL_HORIZONTAL_PADDING = 20; 
  const BOARD_SIZE = SCREEN_WIDTH - EVAL_BAR_WIDTH - GAP - TOTAL_HORIZONTAL_PADDING;

  // Callback from PGNViewer when the board updates (user navigates moves)
  const handleBoardMove = useCallback((fen, moveIndex) => {
      if (fen) {
        // Trigger analysis for the new position
        analyzeFen(fen, { depth }).catch(err => console.log('Analysis trigger error:', err.message));
        setCurrentMoveIndex(moveIndex);
      }
  }, [analyzeFen, depth]);

  return (
    <View style={styles.container}>
        {/* Top: Board Section */}
        <View style={styles.boardSection}>
            <View style={styles.boardRow}>
                {/* Left: Evaluation Bar */}
                <View style={[styles.evalBarContainer, { height: BOARD_SIZE, width: EVAL_BAR_WIDTH, marginRight: GAP }]}>
                    <EvaluationBar 
                        score={liveAnalysis ? Object.values(liveAnalysis)[0]?.evalCp : 0} 
                        mateIn={liveAnalysis ? Object.values(liveAnalysis)[0]?.mateIn : null}
                    />
                </View>
                
                {/* Right: Board */}
                <View style={[styles.boardWrapper, { width: BOARD_SIZE, height: BOARD_SIZE }]}>
                        <PGNViewer 
                            pgnString={pgn} 
                            onMove={handleBoardMove} 
                            boardSize={BOARD_SIZE}
                        />
                </View>
            </View>
        </View>

            {/* Middle: Tabs */}
            <View style={styles.tabContainer}>
                {/* 'Analysis', 'Games', 'Explore' */}
                {['Analysis'].map(tab => (
                    <TouchableOpacity 
                        key={tab} 
                        style={[styles.tabButton, activeTab === tab && styles.tabActive]}
                        onPress={() => setActiveTab(tab)}
                    >
                        <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Bottom: Content Area */}
            <View style={styles.contentSection}>
                {activeTab === 'Analysis' ? (
                    <ScrollView style={styles.analysisScroll}>
                        {/* Header Info */}
                        <View style={styles.headerRow}>
                            <Text style={styles.headerText}>Engine Evaluation</Text>
                            <Text style={styles.headerInfo}>depth={Object.values(liveAnalysis || {})[0]?.depth || depth}</Text>
                        </View>
                        
                        {/* Analysis Lines */}
                        {liveAnalysis ? (
                            <View style={styles.linesContainer}>
                                {Object.values(liveAnalysis)
                                    .sort((a, b) => (a.multipv || 1) - (b.multipv || 1))
                                    .map((line, index) => {
                                    const score = line.mateIn 
                                        ? (line.mateIn > 0 ? `+M${line.mateIn}` : `-M${Math.abs(line.mateIn)}`)
                                        : (line.evalCp !== null ? (line.evalCp > 0 ? `+${(line.evalCp / 100).toFixed(2)}` : (line.evalCp / 100).toFixed(2)) : '...');
                                    
                                    return (
                                        <View key={index} style={styles.lineRow}>
                                            <View style={[styles.scoreContainer, (line.evalCp > 0 || line.mateIn > 0) ? styles.scorePos : styles.scoreNeg]}>
                                                <Text style={[styles.scoreText, (line.evalCp <= 0 && !line.mateIn) && styles.scoreTextNeg]}>{score}</Text>
                                            </View>
                                            <Text style={styles.pvText}>
                                                {line.pv ? line.pv.join(' ') : ''}
                                            </Text>
                                        </View>
                                    );
                                })}
                            </View>
                        ) : (
                            <View style={styles.placeholderContainer}>
                                <Text style={styles.placeholderText}>
                                    {!pgn ? "Paste a PGN to start analysis" : "Waiting for engine..."}
                                </Text>
                                {/* !engineReady && <ActivityIndicator size="small" color="#bababa" /> */}
                            </View>
                        )}
                        
                        {/* PGN Input Area */}
                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>PGN String</Text>
                            <TextInput 
                                style={styles.minInput}
                                placeholder="Paste PGN here..." 
                                placeholderTextColor="#666"
                                value={pgn}
                                onChangeText={setPgn} 
                                multiline
                            />
                        </View>
                        
                        {/* NEW: Move List */}
                        <MoveList 
                            pgn={pgn} 
                            currentMoveIndex={currentMoveIndex}
                        />

                    </ScrollView>
                ) : (
                    <View style={styles.placeholderCenter}>
                        <Text style={styles.placeholderText}>Feature Coming Soon</Text>
                    </View>
                )}
            </View>

        {/* Visible Hidden Stockfish Worker */}
        {/* We need this WebView to exist for Stockfish to run */}
        <WebView
            ref={stockfishWebViewRef}
            originWhitelist={['*']}
            source={{ html: getStockfishHtml() }}
            style={styles.hidden}
            javaScriptEnabled={true}
            domStorageEnabled={true} // often helps
            onMessage={handleMessage}
        />
        </View>
    );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#262421',
  },
  boardSection: {
      marginTop: 40,
      alignItems: 'center',
      backgroundColor: '#211f1d',
      paddingBottom: 0,
      width: '100%',
  },
  boardRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'flex-start',
      width: '100%',
      // Padding handled by calculation
  },
  evalBarContainer: {
      justifyContent: 'center',
      // Height/Width set inline
  },
  boardWrapper: {
      // Dimensions set inline
  }, 
  tabContainer: {
      flexDirection: 'row',
      backgroundColor: '#211f1d',
      borderBottomWidth: 1,
      borderBottomColor: '#302e2c',
      marginTop: 80,
  },
  tabButton: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
  },
  tabActive: {
      borderBottomWidth: 2,
      borderBottomColor: '#81b64c', // Chess.com Green
  },
  tabText: {
      color: '#bababa',
      fontWeight: '600',
      fontSize: 14,
  },
  tabTextActive: {
      color: '#fff',
  },
  contentSection: {
      flex: 1,
      backgroundColor: '#262421',
  },
  analysisScroll: {
      flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: '#302e2c',
  },
  headerText: {
    color: '#bababa',
    fontWeight: '600',
    fontSize: 13,
  },
  headerInfo: {
    color: '#bababa',
    fontSize: 12,
  },
  linesContainer: {
     padding: 0,
  },
  lineRow: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#302e2c',
    alignItems: 'flex-start',
  },
  scoreContainer: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: 10,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scorePos: {
      backgroundColor: '#fff', 
  },
  scoreNeg: {
      backgroundColor: '#403d39', 
      borderWidth: 1,
      borderColor: '#666',
  },
  scoreText: {
    color: '#000', 
    fontWeight: 'bold',
    fontSize: 12,
  },
  scoreTextNeg: {
      color: '#fff',
  },
  pvText: {
    color: '#bababa', // Light gray standard
    flex: 1,
    fontFamily: 'monospace',
    fontSize: 13,
    lineHeight: 18,
  },
  inputContainer: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: '#302e2c',
      marginTop: 20,
  },
  inputLabel: {
      color: '#666',
      fontSize: 12,
      marginBottom: 8,
      fontWeight: '600',
  },
  minInput: {
      color: '#fff',
      backgroundColor: '#302e2c',
      padding: 10,
      borderRadius: 6,
      minHeight: 60,
      textAlignVertical: 'top',
      fontFamily: 'monospace',
      fontSize: 12,
  },
  placeholderContainer: {
      padding: 20,
      alignItems: 'center',
  },
  placeholderText: {
      color: '#666',
      fontStyle: 'italic',
  },
  hidden: {
    width: 0,
    height: 0,
    opacity: 0,
    position: 'absolute',
    top: -1000, 
  },
  placeholderCenter: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
  }
});

export default ChessAnalysisScreen;