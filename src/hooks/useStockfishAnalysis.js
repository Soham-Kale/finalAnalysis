import React, { useState, useCallback } from 'react';
import { parsePGNToPositions } from '../utils/pgnParser';

const useStockfishAnalysis = (webViewRef) => {
  const [analysis, setAnalysis] = useState(null);
  const [liveAnalysis, setLiveAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [engineReady, setEngineReady] = useState(false);
  
  // Store the pending promise resolver/rejecter
  const pendingRequest = React.useRef(null);

  // Handle messages from WebView
  const handleMessage = useCallback((event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      console.log('Message from WebView:', message);

      if (message.type === 'engine_ready') {
        setEngineReady(true);
      } else if (message.type === 'analysis_result') {
        setAnalysis(message.data);
        setIsAnalyzing(false);
        setLiveAnalysis(null); // Clear live analysis on finish
        
        // Resolve the pending promise if it exists
        if (pendingRequest.current) {
            clearTimeout(pendingRequest.current.timeout);
            pendingRequest.current.resolve(message.data);
            pendingRequest.current = null;
        }
      } else if (message.type === 'error') {
        setError(message.message);
        setIsAnalyzing(false);
        setLiveAnalysis(null);
        
        // Reject the pending promise if it exists
        if (pendingRequest.current) {
            clearTimeout(pendingRequest.current.timeout);
            pendingRequest.current.reject(new Error(message.message));
            pendingRequest.current = null;
        }
      } else if (message.type === 'debug') {
        console.log('WebView Debug:', message.message);
      } else if (message.type === 'analysis_update') {
          setLiveAnalysis(message.data);
      }
    } catch (e) {
      console.error('Error parsing message:', e);
    }
  }, []);

  const analyze = useCallback(async (pgn, options = {}) => {
    if (!engineReady) {
      throw new Error('Stockfish engine is not ready yet');
    }

    // Cancel any existing pending request
    if (pendingRequest.current) {
        clearTimeout(pendingRequest.current.timeout);
        pendingRequest.current.reject(new Error('Analysis cancelled by new request'));
        pendingRequest.current = null;
    }

    setIsAnalyzing(true);
    setLiveAnalysis(null);
    setError(null);

    try {
      const { positions } = parsePGNToPositions(pgn);
      if (!positions || !positions.length) {
        throw new Error('Invalid or empty PGN');
      }

      const position = positions[positions.length - 1];
      const { fen } = position;

      const message = JSON.stringify({
        type: 'analyze',
        fen,
        depth: options.depth || 15
      });
      
      console.log('Sending message to WebView:', message);
      webViewRef.current?.postMessage(message);

      // Return a promise that resolves when analysis is complete
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (pendingRequest.current) {
            pendingRequest.current = null;
            setIsAnalyzing(false);
            reject(new Error('Analysis timed out (60s)'));
          }
        }, 60000);

        // Store the resolver in the ref so handleMessage can access it
        pendingRequest.current = { resolve, reject, timeout };
      });
    } catch (error) {
      setIsAnalyzing(false);
      setError(error.message);
      throw error;
    }
  }, [engineReady, webViewRef]);

  const stopAnalysis = useCallback(() => {
    const message = JSON.stringify({
      type: 'stop_analysis'
    });
    console.log('Sending stop message to WebView:', message);
    webViewRef.current?.postMessage(message);
    setIsAnalyzing(false);
    
    if (pendingRequest.current) {
        clearTimeout(pendingRequest.current.timeout);
        pendingRequest.current.reject(new Error('Analysis stopped'));
        pendingRequest.current = null;
    }
  }, [webViewRef]);

  return {
    analyze,
    analysis,
    liveAnalysis, // New return
    isAnalyzing,
    error,
    engineReady,
    stopAnalysis,
    handleMessage
  };
};

export default useStockfishAnalysis;