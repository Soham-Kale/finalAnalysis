import { STOCKFISH_SCRIPT_URL } from '../constants';

class StockfishService {
  constructor(onUpdate) {
    this.worker = null;
    this.onUpdate = onUpdate;
    this.isReady = false;
  }

  async init() {
    if (this.worker) return;

    try {
      const response = await fetch(STOCKFISH_SCRIPT_URL);
      const scriptContent = await response.text();
      const blob = new Blob([scriptContent], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);

      this.worker = new Worker(workerUrl);
      this.worker.onmessage = (e) => this.handleMessage(e.data);
      this.worker.postMessage('uci');
    } catch (err) {
      console.error("Failed to load Stockfish:", err);
    }
  }

  handleMessage(data) {
    if (data === 'uciok') {
      this.isReady = true;
      if (this.onUpdate) this.onUpdate({ isReady: true });
    }

    if (data.startsWith('info depth')) {
      this.parseInfoLine(data);
    }
  }

  parseInfoLine(line) {
    if (!this.onUpdate) return;

    const parts = line.split(' ');
    const update = {
      evaluation: 0,
      mate: null,
      bestLine: [],
      lines: []
    };

    let currentLine = [];
    let isInPv = false;
    let currentPv = [];

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      if (part === 'cp') {
        update.evaluation = parseFloat(parts[i + 1]) / 100;
      } else if (part === 'mate') {
        update.mate = parseInt(parts[i + 1]);
      } else if (part === 'pv') {
        isInPv = true;
        currentPv = [];
      } else if (isInPv) {
        currentPv.push(part);
      }
    }

    if (currentPv.length > 0) {
      update.bestLine = currentPv;
      update.lines = [{
        moves: currentPv,
        score: update.evaluation,
        mate: update.mate
      }];
    }

    this.onUpdate(update);
  }

  analyzePosition(fen, depth = 18, multiPV = 3) {
    if (!this.isReady || !this.worker) return;

    this.worker.postMessage('stop');
    this.worker.postMessage(`position fen ${fen}`);
    this.worker.postMessage(`setoption name MultiPV value ${multiPV}`);
    this.worker.postMessage(`go depth ${depth}`);
  }

  stopAnalysis() {
    if (this.worker) {
      this.worker.postMessage('stop');
    }
  }

  setOption(name, value) {
    if (this.worker) {
      this.worker.postMessage(`setoption name ${name} value ${value}`);
    }
  }

  quit() {
    if (this.worker) {
      this.worker.postMessage('quit');
      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
    }
  }
}

export default StockfishService;
