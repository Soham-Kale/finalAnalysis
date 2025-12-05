import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import StockfishWebView from './StockfishWebView';
import useStockfishAnalysis from '../hooks/useStockfishAnalysis';

const ChessAnalysisScreen = () => {
  const [pgn, setPgn] = useState('');
  const [moveIndex, setMoveIndex] = useState(-1);
  const [depth, setDepth] = useState(15);
  const [chessjsReady, setChessjsReady] = useState(false);
  const [parsingStatus, setParsingStatus] = useState(null);
  const [lastPGN, setLastPGN] = useState('');
  const [error, setError] = useState(null);

  const webViewRef = useRef(null);
  
  const { 
    analyze, 
    analysis, 
    isAnalyzing, 
    // error, 
    engineReady, 
    logs, 
    stopAnalysis,
    ping
  } = useStockfishAnalysis(webViewRef);

  // Sample PGN for testing
  const samplePGN = `1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 11. Nbd2 Bb7 12. Bc2 Re8 13. Nf1 Bf8 14. Ng3 g6 15. Bg5 h6 16. Bd2 exd4 17. cxd4 c5 18. d5 Nb6 19. a4 Nbd7 20. axb5 axb5 21. Ra6 Qc7 22. Qb1 Rxa6 23. Bxa6 Qa7 24. Bxb5 Qxb6 25. Bxd7 Qxd7 26. Qa2 Kg7 27. Qa7 Qc7 28. Qxc7 Bxc7 29. Ra1 Rb8 30. Ra6 Bd8 31. Kf1 Kf8 32. Ke2 Ke7 33. Kd3 Kd7 34. Kc3 Bb6 35. Ra1 Bd8 36. Ra6 Bb6 37. Ra1 Bd8 38. Ra6`;

  // Validate PGN before analysis
  const validatePGN = async () => {
    if (!pgn.trim()) {
      Alert.alert('Error', 'Please enter a PGN string');
      return false;
    }
    
    if (!engineReady) {
      Alert.alert('Error', 'Stockfish engine is not ready yet');
      return false;
    }
    
    if (!chessjsReady) {
      Alert.alert('Error', 'Chess parser is not ready');
      return false;
    }
    
    // Test the PGN
    setParsingStatus('validating');
    
    // Send test message to WebView
    webViewRef.current.postMessage({
      action: 'test_pgn',
      pgn: pgn
    });
    
    return new Promise((resolve) => {
      // Set timeout for validation
      const timeout = setTimeout(() => {
        setParsingStatus(null);
        resolve(true); // Let it try anyway
      }, 3000);
      
      // We'll handle the test result in the message handler
    });
  };

  const handleAnalyze = async () => {
    if (pgn === lastPGN && analysis) {
      Alert.alert('Info', 'Same PGN already analyzed. Change PGN or try again.');
      return;
    }
    
    setLastPGN(pgn);
    setParsingStatus('parsing');
    
    try {
      // First validate the PGN
      const isValid = await validatePGN();
      
      if (isValid) {
        await analyze(pgn, { 
          depth: depth,
          multiPv: 3,
          moveIndex: moveIndex
        });
      }
    } catch (e) {
      console.error('Analysis error:', e);
      Alert.alert('Error', 'Failed to analyze: ' + (e.message || 'Unknown error'));
    } finally {
      setParsingStatus(null);
    }
  };

  const handleSamplePGN = () => {
    setPgn(samplePGN);
    setLastPGN(''); // Reset so we can analyze again
  };

  const handleClear = () => {
    setPgn('');
    setLastPGN('');
    setParsingStatus(null);
    stopAnalysis();
  };

  const handleIncreaseDepth = () => {
    setDepth(prev => Math.min(prev + 5, 30));
  };

  const handleDecreaseDepth = () => {
    setDepth(prev => Math.max(prev - 5, 5));
  };

  const handleMessage = (message) => {
    // Handle additional message types
    switch (message.type) {
      case 'chessjs_ready':
        setChessjsReady(true);
        console.log('Chess.js ready');
        break;
        
      case 'status':
        if (message.data) {
          setChessjsReady(message.data.chessjs || false);
        }
        break;
        
      case 'test_result':
        if (message.data) {
          if (message.data.success) {
            setParsingStatus('valid');
            console.log('PGN validated successfully');
          } else {
            setParsingStatus('invalid');
            Alert.alert(
              'Invalid PGN',
              message.data.error || 'Could not parse the PGN. Make sure it contains valid chess moves.',
              [
                { text: 'Use Anyway', onPress: () => {
                  // User wants to try anyway
                  setParsingStatus(null);
                }},
                { text: 'Cancel', style: 'cancel' }
              ]
            );
          }
        }
        break;
        
      case 'pgn_parsed':
        if (message.data) {
          if (message.data.success) {
            console.log('PGN parsed successfully:', message.data.moveCount, 'moves');
          } else {
            console.log('PGN parsing failed:', message.data.error);
          }
        }
        break;
    }
  };

  // Get the hook's message handler
  const hookMessageHandler = (message) => {
    // First let the hook handle it
    // (In the actual hook, we need to expose a method to handle messages)
    // For now, we'll handle some messages here and pass others to hook
    
    handleMessage(message);
    
    // Also handle hook-specific messages
    if (message.type === 'engine_ready') {
      console.log('Stockfish engine ready');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Chess PGN Analysis</Text>
        
        {/* Engine Status */}
        <View style={styles.statusContainer}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, engineReady ? styles.statusReady : styles.statusLoading]} />
            <Text style={styles.statusText}>
              Stockfish: {engineReady ? 'Ready' : 'Loading...'}
            </Text>
          </View>
        </View>

        {/* PGN Input */}
        <Text style={styles.label}>PGN String:</Text>
        <TextInput
          style={styles.input}
          multiline
          numberOfLines={6}
          value={pgn}
          onChangeText={(text) => {
            setPgn(text);
            if (text !== lastPGN) {
              setParsingStatus(null);
            }
          }}
          placeholder="Paste PGN string here...
          Example: 1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6...
          Or load sample PGN using button above."
          placeholderTextColor="#666"
          textAlignVertical="top"
        />
        
        {/* PGN Validation Status */}
        {parsingStatus && (
          <View style={[
            styles.validationContainer,
            parsingStatus === 'valid' ? styles.validContainer : 
            parsingStatus === 'invalid' ? styles.invalidContainer :
            styles.validatingContainer
          ]}>
            <ActivityIndicator 
              size="small" 
              color={parsingStatus === 'validating' ? '#3498db' : 
                    parsingStatus === 'valid' ? '#2ecc71' : '#e74c3c'} 
              animating={parsingStatus === 'validating'}
            />
            <Text style={styles.validationText}>
              {parsingStatus === 'validating' && 'Validating PGN...'}
              {parsingStatus === 'valid' && '✓ PGN is valid'}
              {parsingStatus === 'invalid' && '✗ PGN may be invalid'}
            </Text>
          </View>
        )}

        {/* Analysis Controls */}
        <View style={styles.controlsContainer}>
          <View style={styles.depthControl}>
            <Text style={styles.depthLabel}>Analysis Depth: {depth}</Text>
            <View style={styles.depthButtons}>
              <TouchableOpacity style={styles.depthButton} onPress={handleDecreaseDepth}>
                <Text style={styles.depthButtonText}>-</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.depthButton} onPress={handleIncreaseDepth}>
                <Text style={styles.depthButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.analyzeButton, 
                (!engineReady || !chessjsReady || !pgn.trim() || isAnalyzing || parsingStatus === 'invalid') && styles.disabledButton
              ]} 
              onPress={handleAnalyze}
              // disabled={!engineReady || !chessjsReady || !pgn.trim() || isAnalyzing || parsingStatus === 'invalid'}
            >
              <Text style={styles.analyzeButtonText}>
                {isAnalyzing ? 'Analyzing...' : 'Analyze PGN'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Loading Indicator */}
        {isAnalyzing && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Stockfish is analyzing position...</Text>
            <Text style={styles.loadingSubtext}>This may take a few seconds</Text>
            <TouchableOpacity style={styles.stopButton} onPress={stopAnalysis}>
              <Text style={styles.stopButtonText}>Stop Analysis</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Error Display */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Error:</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} 
            onPress={() => setError(null)}
            >
              <Text style={styles.retryButtonText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Results */}
        {analysis && !analysis.isPartial && (
          <View style={styles.results}>
            <Text style={styles.sectionTitle}>Analysis Results</Text>
            
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Best Move:</Text>
              <View style={styles.bestMoveBox}>
                <Text style={styles.bestMoveText}>{analysis.bestMove}</Text>
              </View>
            </View>
            
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Evaluation:</Text>
              <View style={[
                styles.evalBox, 
                analysis.evaluation > 0 ? styles.positiveEval : styles.negativeEval
              ]}>
                <Text style={styles.evalText}>
                  {analysis.evaluation > 0 ? '+' : ''}{analysis.evaluation.toFixed(2)} 
                  {Math.abs(analysis.evaluation) > 10 ? ' (mate)' : ' pawns'}
                </Text>
              </View>
            </View>
            
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Depth:</Text>
              <Text style={styles.resultValue}>{analysis.depth}</Text>
            </View>
            
            {analysis.san && (
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Analyzed Move:</Text>
                <Text style={styles.resultValue}>{analysis.san} (#{analysis.moveNumber})</Text>
              </View>
            )}

            <Text style={styles.subSectionTitle}>Top Moves</Text>
            {analysis.topMoves && analysis.topMoves.map((item, index) => (
              <View key={index} style={styles.moveItem}>
                <View style={styles.moveRank}>
                  <Text style={styles.moveRankText}>{index + 1}</Text>
                </View>
                <View style={styles.moveContent}>
                  <Text style={styles.moveText}>{item.move}</Text>
                  <Text style={styles.moveScore}>
                    {item.score > 0 ? '+' : ''}{item.score.toFixed(2)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>How to use:</Text>
          <Text style={styles.instruction}>1. Paste a valid PGN string in the box above</Text>
          <Text style={styles.instruction}>2. Click "Analyze PGN" to get Stockfish analysis</Text>
          <Text style={styles.instruction}>3. Use the sample PGN button for testing</Text>
          <Text style={styles.instruction}>4. Adjust analysis depth as needed</Text>
        </View>
      </ScrollView>

      {/* Hidden WebView */}
      <StockfishWebView
        ref={webViewRef}
        onMessage={hookMessageHandler}
        style={styles.hidden}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f5f7fa',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  title: { 
    fontSize: 28, 
    color: '#2c3e50', 
    fontWeight: 'bold', 
    marginBottom: 16,
    marginTop: 25,
    textAlign: 'center',
  },
  statusContainer: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  statusReady: {
    backgroundColor: '#2ecc71',
  },
  statusLoading: {
    backgroundColor: '#f39c12',
  },
  statusText: {
    fontSize: 16,
    color: '#2c3e50',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  sampleButton: {
    backgroundColor: '#3498db',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  sampleButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  input: { 
    height: 120, 
    borderWidth: 1, 
    borderColor: '#ccc', 
    borderRadius: 8,
    padding: 12, 
    marginBottom: 12,
    color: '#000000', 
    backgroundColor: '#fff',
    textAlignVertical: 'top',
    fontSize: 14,
  },
  validationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
  },
  validatingContainer: {
    backgroundColor: '#e8f4fc',
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  validContainer: {
    backgroundColor: '#d5f4e6',
    borderLeftWidth: 4,
    borderLeftColor: '#2ecc71',
  },
  invalidContainer: {
    backgroundColor: '#fdeaea',
    borderLeftWidth: 4,
    borderLeftColor: '#e74c3c',
  },
  validationText: {
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '500',
  },
  controlsContainer: {
    marginBottom: 16,
  },
  depthControl: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  depthLabel: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '600',
  },
  depthButtons: {
    flexDirection: 'row',
  },
  depthButton: {
    backgroundColor: '#ecf0f1',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  depthButtonText: {
    fontSize: 20,
    color: '#2c3e50',
    fontWeight: 'bold',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  clearButton: {
    flex: 1,
    backgroundColor: '#e74c3c',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  analyzeButton: {
    flex: 2,
    backgroundColor: '#2ecc71',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#bdc3c7',
  },
  clearButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  analyzeButtonText: {
    color: 'white',
    fontWeight: 'bold',
    backgroundColor: "blue",
    fontSize: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  loadingText: {
    marginVertical: 12,
    fontSize: 16,
    color: '#7f8c8d',
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#95a5a6',
    marginBottom: 12,
  },
  stopButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
  stopButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 8,
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 14,
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#f44336',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  results: { 
    marginTop: 16, 
    padding: 20, 
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: { 
    fontSize: 20,
    fontWeight: 'bold', 
    color: '#2c3e50',
    marginBottom: 16,
  },
  subSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginTop: 16,
    marginBottom: 8,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    width: 120,
  },
  bestMoveBox: {
    backgroundColor: '#3498db',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    flex: 1,
  },
  bestMoveText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  evalBox: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    flex: 1,
  },
  positiveEval: {
    backgroundColor: '#27ae60',
  },
  negativeEval: {
    backgroundColor: '#e74c3c',
  },
  evalText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  resultValue: {
    fontSize: 16,
    color: '#2c3e50',
    flex: 1,
  },
  moveItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  moveRank: {
    backgroundColor: '#ecf0f1',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  moveRankText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  moveContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  moveText: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '500',
  },
  moveScore: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  instructions: {
    backgroundColor: '#e8f4fc',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3498db',
    marginTop: 16,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  instruction: {
    fontSize: 14,
    color: '#34495e',
    marginBottom: 4,
    lineHeight: 20,
  },
  hidden: { 
    height: 0, 
    width: 0, 
    opacity: 0,
    position: 'absolute',
  },
});

export default ChessAnalysisScreen;