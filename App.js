import React from 'react';
import { SafeAreaView, StyleSheet, StatusBar } from 'react-native';
import ChessAnalysisScreen from './src/screens/ChessAnalysisScreen';

function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <ChessAnalysisScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
});

export default App;