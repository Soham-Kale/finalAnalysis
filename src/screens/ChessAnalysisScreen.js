import React, { useState, useRef } from 'react';
import { View, Text, TextInput, Button, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import useStockfishAnalysis from '../hooks/useStockfishAnalysis';
import { getStockfishHtml } from '../utils/stockfishHtml';

const ChessAnalysisScreen = () => {
  const [pgn, setPgn] = useState('');
  const [depth, setDepth] = useState(15);
  const webViewRef = useRef(null);

  const {
    analyze,
    analysis,
    liveAnalysis,
    isAnalyzing,
    error,
    engineReady,
    stopAnalysis,
    handleMessage
  } = useStockfishAnalysis(webViewRef); // Pass webViewRef to the hook

  console.log('engineReady', engineReady);

  const handleAnalyze = async () => {
    if (!pgn.trim()) {
      Alert.alert('Error', 'Please enter a PGN string');
      return;
    }

    try {
      const result = await analyze(pgn, { depth });
      console.log('Analysis complete:', result);
    } catch (err) {
      Alert.alert('Analysis Error', err.message);
    }
  };

  return (
    <View style={styles.container}>
      {error && <Text style={styles.error}>{error}</Text>}
      
      {!engineReady && !error ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text>Initializing Stockfish engine...</Text>
        </View>
      ) : (
        <>
          <TextInput
            style={styles.pgnInput}
            multiline
            placeholder="Paste PGN here..."
            value={pgn}
            onChangeText={setPgn}
          />
          
          <View style={styles.controls}>
            <Text>Analysis Depth: {depth}</Text>
          </View>

          <Button
            style={styles.Button}
            title={isAnalyzing ? "Analyzing..." : "Analyze PGN"}
            onPress={handleAnalyze}
            // disabled={isAnalyzing || !pgn.trim()}
          />

          {liveAnalysis && (
            <View style={styles.results}>
              <Text>Live Analysis:</Text>
              {liveAnalysis.mateIn !== null && liveAnalysis.mateIn !== undefined ? (
                <Text style={styles.evalText}>Mate in {liveAnalysis.mateIn}</Text>
              ) : (
                <Text style={styles.evalText}>Evaluation: {liveAnalysis.evalCp ? liveAnalysis.evalCp / 100 : '...'}</Text>
              )}
              
              <Text style={styles.pvLabel}>Best Line (PV):</Text>
              {liveAnalysis.pv && (
                  <Text style={styles.pvText}>
                    {liveAnalysis.pv.slice(0, 10).join(' ')} {liveAnalysis.pv.length > 10 ? '...' : ''}
                  </Text>
              )}
            </View>
          )}

          {analysis && !liveAnalysis && (
            <View style={styles.results}>
              <Text>Best Move: {analysis.bestMove}</Text>
              <Text>Depth: {analysis.depth}</Text>
            </View>
          )}
        </>
      )}

      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: getStockfishHtml() }}
        style={styles.hidden}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onMessage={handleMessage}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.warn('WebView error: ', nativeEvent);
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.warn('WebView HTTP error: ', nativeEvent);
        }}
        onLoadEnd={() => {
          console.log('WebView loaded');
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  analyzeButton: {
    color: "#007AFF",
    // color: "white",
  },  
  pgnInput: {
    height: 100,
    borderColor: 'gray',
    borderWidth: 1,
    marginBottom: 16,
    marginTop: 60,
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controls: {
    marginBottom: 16,
  },
  results: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  error: {
    color: 'red',
    marginTop: 8,
  },
  hidden: {
    width: 0,
    height: 0,
    position: 'absolute',
  },
  evalText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#333',
      marginVertical: 4
  },
  pvLabel: {
      fontWeight: '600',
      marginTop: 8
  },
  pvText: {
      fontFamily: 'monospace',
      marginTop: 2,
      color: '#555'
  }
});

export default ChessAnalysisScreen;