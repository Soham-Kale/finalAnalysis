import React, { useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Chess } from 'chess.js';

const MoveList = ({ pgn, currentMoveIndex, onMoveSelect }) => {
  const scrollViewRef = useRef(null);

  const moves = useMemo(() => {
    const chess = new Chess();
    try {
      if (pgn) chess.loadPgn(pgn);
    } catch (e) {
      console.log('MoveList PGN parse error:', e);
    }
    const history = chess.history({ verbose: true });

    // Pair moves [White, Black]
    const pairs = [];
    let i = 0;
    while (i < history.length) {
      pairs.push({
        moveNumber: Math.floor(i / 2) + 1,
        white: history[i],
        black: history[i + 1] || null,
      });
      i += 2;
    }
    return pairs;
  }, [pgn]);

  // Auto-scroll to current move
  useEffect(() => {
    // Basic auto-scroll logic could go here if we tracked ref positions
    // For now, simpler implementation
  }, [currentMoveIndex]);

  if (!moves.length) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No moves available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>White - Black</Text>
      </View>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {moves.map((pair, index) => {
          // currentMoveIndex is ply (half-move).
          // pair index 0 => plies 0, 1 (Move 1)
          // if currentMoveIndex is 1 => White moved (Move 1 white)
          // if currentMoveIndex is 2 => Black moved (Move 1 black)

          // Note: currentMoveIndex 0 is Start Position. 1 is after White's first move.

          const isWhiteActive = currentMoveIndex === pair.moveNumber * 2 - 1;
          const isBlackActive = currentMoveIndex === pair.moveNumber * 2;

          return (
            <View key={index} style={styles.row}>
              <Text style={styles.moveNum}>{pair.moveNumber}.</Text>

              <TouchableOpacity
                style={[styles.moveCell, isWhiteActive && styles.activeMove]}
                // Optional: Implement jump to move
                // onPress={() => onMoveSelect((pair.moveNumber * 2) - 1)}
              >
                <Text
                  style={[styles.moveText, isWhiteActive && styles.activeText]}
                >
                  {pair.white.san}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.moveCell, isBlackActive && styles.activeMove]}
                // onPress={() => onMoveSelect(pair.moveNumber * 2)}
              >
                <Text
                  style={[styles.moveText, isBlackActive && styles.activeText]}
                >
                  {pair.black ? pair.black.san : ''}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#262421',
    marginTop: 10,
  },
  header: {
    padding: 10,
    backgroundColor: '#302e2c',
    borderBottomWidth: 1,
    borderBottomColor: '#403d39',
  },
  headerText: {
    color: '#bababa',
    fontWeight: 'bold',
    fontSize: 12,
  },
  scroll: {
    flex: 1,
    maxHeight: 300, // Limit height
  },
  scrollContent: {
    paddingBottom: 20,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#302e2c',
    alignItems: 'center',
  },
  moveNum: {
    color: '#666',
    width: 40,
    fontSize: 14,
    fontFamily: 'monospace',
  },
  moveCell: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  activeMove: {
    backgroundColor: '#45413e', // Highlight background
  },
  moveText: {
    color: '#bababa',
    fontSize: 14,
    fontWeight: '600',
  },
  activeText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  emptyText: {
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
});

export default MoveList;
