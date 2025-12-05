import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  Button, 
  TextInput, 
  ScrollView,
  ActivityIndicator,
  StyleSheet 
} from 'react-native';
import Stockfish from 'stockfish';
import { Chess } from 'chess.js';

const PgnAnalyzer = () => {
  const [pgnInput, setPgnInput] = useState('');
  const [analysis, setAnalysis] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const engineRef = useRef(null);
  const chessRef = useRef(new Chess());

  const initEngine = () => {
    if (engineRef.current) return engineRef.current;
    
    const engine = new Stockfish();
    engineRef.current = engine;
    
    engine.onmessage = (line) => {
      console.log('Engine:', line);
    };
    
    engine.postMessage('uci');
    engine.postMessage('setoption name Threads value 2');
    engine.postMessage('isready');
    
    return engine;
  };

  const analyzePGN = async () => {
    if (!pgnInput.trim()) return;
    
    setIsAnalyzing(true);
    const engine = initEngine();
    chessRef.current.loadPgn(pgnInput);
    
    const moves = chessRef.current.history();
    const analysisResults = [];
    
    // Reset to initial position
    const game = new Chess();
    
    for (let i = 0; i < moves.length; i++) {
      try {
        game.move(moves[i]);
        const fen = game.fen();
        
        // Analyze this position
        const result = await analyzePosition(engine, fen);
        
        analysisResults.push({
          moveNumber: Math.floor(i / 2) + 1,
          move: moves[i],
          player: i % 2 === 0 ? 'White' : 'Black',
          fen: fen,
          evaluation: result.evaluation,
          bestMove: result.bestMove,
          isBlunder: result.isBlunder
        });
        
        // Update UI progressively
        setAnalysis([...analysisResults]);
        
      } catch (error) {
        console.log('Error analyzing move:', moves[i], error);
      }
    }
    
    setIsAnalyzing(false);
  };

  const analyzePosition = (engine, fen) => {
    return new Promise((resolve) => {
      let evaluation = null;
      let bestMove = null;
      
      const messageHandler = (line) => {
        if (line.includes('score cp')) {
          // Parse centipawn evaluation
          const parts = line.split(' ');
          const cpIndex = parts.indexOf('score');
          if (cpIndex !== -1) {
            const cp = parseInt(parts[cpIndex + 2]);
            evaluation = cp / 100; // Convert to pawns
          }
        }
        
        if (line.startsWith('bestmove')) {
          bestMove = line.split(' ')[1];
          
          // Check if the move played was a blunder
          const isBlunder = evaluation && Math.abs(evaluation) > 1.0;
          
          resolve({ evaluation, bestMove, isBlunder });
        }
      };
      
      // Temporarily replace handler
      const originalHandler = engine.onmessage;
      engine.onmessage = messageHandler;
      
      // Send analysis command
      engine.postMessage(`position fen ${fen}`);
      engine.postMessage('go depth 15 movetime 2000');
      
      // Restore original handler after 2.5 seconds
      setTimeout(() => {
        engine.onmessage = originalHandler;
      }, 2500);
    });
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>PGN Analyzer</Text>
      
      <TextInput
        style={styles.pgnInput}
        multiline
        numberOfLines={10}
        placeholder="Paste PGN here..."
        value={pgnInput}
        onChangeText={setPgnInput}
      />
      
      <Button
        title={isAnalyzing ? "Analyzing..." : "Analyze PGN"}
        onPress={analyzePGN}
        disabled={isAnalyzing || !pgnInput.trim()}
      />
      
      {isAnalyzing && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text>Analyzing moves...</Text>
        </View>
      )}
      
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsTitle}>Analysis Results:</Text>
        
        {analysis.map((item, index) => (
          <View key={index} style={styles.resultItem}>
            <Text style={styles.moveText}>
              {item.moveNumber}. {item.move} ({item.player})
            </Text>
            <Text>Evaluation: {item.evaluation?.toFixed(2) || 'N/A'}</Text>
            <Text>Best Move: {item.bestMove || 'N/A'}</Text>
            {item.isBlunder && (
              <Text style={styles.blunderText}>⚠️ Blunder!</Text>
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  pgnInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 20,
    minHeight: 150,
    backgroundColor: 'white',
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  resultsContainer: {
    marginTop: 30,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  resultItem: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  moveText: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
  blunderText: {
    color: 'red',
    fontWeight: 'bold',
    marginTop: 5,
  },
});

export default PgnAnalyzer;