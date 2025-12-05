export const getStockfishHtml = () => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
  <div id="debug">Initializing...</div>
  <script>
    const debugDiv = document.getElementById('debug');
    function log(msg) {
      console.log(msg);
      debugDiv.innerText = msg;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message: msg }));
    }

    let engine;
    let pendingCommands = [];

    async function initEngine() {
      try {
        log('Fetching Stockfish script...');
        // Fetch the script content
        const response = await fetch('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.0/stockfish.js');
        if (!response.ok) throw new Error('Failed to fetch script: ' + response.status);
        
        const scriptContent = await response.text();
        log('Script fetched. Creating Blob...');
        
        // Create a Blob from the script content
        const blob = new Blob([scriptContent], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        log('Blob created: ' + workerUrl);

        // Initialize Worker from Blob URL
        engine = new Worker(workerUrl);
        
        engine.onmessage = function(event) {
          const line = event.data;
          // log('Engine: ' + line); // Verbose logging
          
          if (line === 'uciok' || line === 'readyok') {
            log('Engine ready: ' + line);
            // Process any pending commands after initialization
            pendingCommands.forEach(cmd => engine.postMessage(cmd));
            pendingCommands = [];
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'response', line: line }));
          }
          // Forward all engine lines to RN
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'engine_line', line: line }));
        };

        engine.onerror = function(err) {
          log('Worker error: ' + err.message);
        };

        // Initialize UCI
        log('Sending UCI...');
        engine.postMessage('uci');
        
        // Wait a bit and check readiness
        setTimeout(() => {
             engine.postMessage('isready');
        }, 500);

      } catch (e) {
        log('Init error: ' + e.message);
      }
    }

    initEngine();

    // Listen for commands from React Native
    window.addEventListener('message', (event) => {
      try {
        // Handle both string and object data
        let data = event.data;
        if (typeof data === 'string') {
            try {
                data = JSON.parse(data);
            } catch (e) {
                // If not JSON, ignore or handle as raw string if needed
            }
        }

        if (data && data.type === 'command') {
          const cmd = data.command;
          log('CMD: ' + cmd);
          if (engine && !pendingCommands.length) {
            engine.postMessage(cmd);
          } else {
            pendingCommands.push(cmd);
          }
        }
      } catch (e) {
        log('Message parse error: ' + e.message);
      }
    });
  </script>
</body>
</html>
`;