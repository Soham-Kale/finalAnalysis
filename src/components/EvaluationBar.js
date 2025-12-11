import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

const EvaluationBar = ({ score, mateIn, inverse = false }) => {
  // Score is usually in centipawns (e.g., 100 = 1 pawn advantage)
  // We need to map this to a percentage height for the white bar.
  
  // Cap visual advantage at +5 / -5 pawns (500 cp)
  const MAX_CP = 500;
  
  let whitePercentage = 50; // Default 50% (Equal)

  if (mateIn !== undefined && mateIn !== null) {
     if (mateIn > 0) {
         whitePercentage = 100; // White mates
     } else {
         whitePercentage = 0; // Black mates
     }
  } else if (score !== undefined && score !== null) {
      // Sigmoid-like or linear clamp? Linear clamp is simpler for now.
      const clampedScore = Math.max(-MAX_CP, Math.min(MAX_CP, score));
      // Map -500..500 to 0..100
      // -500 => 0%
      // 0    => 50%
      // 500  => 100%
      whitePercentage = ((clampedScore + MAX_CP) / (2 * MAX_CP)) * 100;
  }

  // Invert if needed (e.g. if board is flipped, though usually bar stays relative to white)
  // Standard: White at bottom, fills up.
  
  // Format the label
  let label = '0.0';
  if (mateIn !== undefined && mateIn !== null) {
      label = `M${Math.abs(mateIn)}`;
  } else if (score !== undefined && score !== null) {
      label = (Math.abs(score) / 100).toFixed(1);
  }
  
  const isWhiteWinning = whitePercentage > 50;

  return (
    <View style={styles.container}>
      {/* Background is Dark (Black) */}
      <View style={styles.barBackground}>
          {/* Foreground is Light (White) - Uses height percentage */}
          <View style={[styles.whiteBar, { height: `${whitePercentage}%` }]} />
          
          {/* Label Container - Absolute positioned */}
          <View style={[styles.labelContainer, isWhiteWinning ? styles.labelBottom : styles.labelTop]}>
              <Text style={[styles.labelText, isWhiteWinning ? styles.textDark : styles.textLight]}>
                  {label}
              </Text>
          </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 24,
    // Height will be determined by parent (should match board height)
    height: '100%', 
    marginRight: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barBackground: {
    flex: 1,
    backgroundColor: '#403d39', // Black's color
    position: 'relative',
  },
  whiteBar: {
    backgroundColor: '#ffffff', // White's color
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  labelContainer: {
      position: 'absolute',
      width: '100%',
      alignItems: 'center',
      paddingVertical: 4,
  },
  labelTop: {
      top: 0,
  },
  labelBottom: {
      bottom: 0,
  },
  labelText: {
      fontSize: 10,
      fontWeight: '700',
  },
  textLight: {
      color: '#fff',
  },
  textDark: {
      color: '#403d39',
  }
});

export default EvaluationBar;
