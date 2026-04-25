const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
const PORT = process.env.PORT || 5000;

// === Biến lưu trạng thái ===
let currentData = {
  id: "@NguyenTung1920",
  phien: null,
  xuc_xac_1: null,
  xuc_xac_2: null,
  xuc_xac_3: null,
  ket_qua: "",
  pattern: "",
  du_doan: "?",
  tong_dung: 0,
  tong_sai: 0,
};
let id_phien_chua_co_kq = null;
let patternHistory = []; // Lưu dãy T/X gần nhất

// === Danh sách tin nhắn gửi lên server WebSocket ===
const messagesToSend = [
  [1, "MiniGame", "SC_dsucac", "binhsex", {
    "info": "{\"ipAddress\":\"\",\"userId\":\"\",\"username\":\"\",\"timestamp\":,\"refreshToken\":\"\"}",
    "signature": ""
  }],
  [6, "MiniGame", "taixiuPlugin", { cmd: 1005 }],
  [6, "MiniGame", "lobbyPlugin", { cmd: 10001 }]
];

// === WebSocket ===
let ws = null;
let pingInterval = null;
let reconnectTimeout = null;
let isManuallyClosed = false;

function duDoanTiepTheo(pattern) {
  if (pattern.length < 6) return "?";

  const last3 = pattern.slice(-3).join('');
  const last4 = pattern.slice(-4).join('');

  // Kiểm tra nếu 3 ký tự cuối lặp (vd: TXT → TXT)
  const count = pattern.join('').split(last3).length - 1;
  if (count >= 2) return last3[0]; // đoán tiếp theo là chữ đầu chuỗi

  // Nếu thấy lặp 2 lần gần đây
  const count4 = pattern.join('').split(last4).length - 1;
  if (count4 >= 2) return last4[0];

  return "?";
}

function connectWebSocket() {
  ws = new WebSocket("wss://websocket.azhkthg1.net/wsbinary?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJnZW5kZXIiOjAsImNhblZpZXdTdGF0IjpmYWxzZSwiZGlzcGxheU5hbWUiOiJnZ2ZiZ2ZkYmZiYmZnYmciLCJib3QiOjAsImlzTWVyY2hhbnQiOmZhbHNlLCJ2ZXJpZmllZEJhbmtBY2NvdW50IjpmYWxzZSwicGxheUV2ZW50TG9iYnkiOmZhbHNlLCJjdXN0b21lcklkIjozMTQ5MDA3MDAsImFmZklkIjoic3VuLndpbiIsImJhbm5lZCI6ZmFsc2UsImJyYW5kIjoic3VuLndpbiIsInRpbWVzdGFtcCI6MTc1NjY5MDEzNDc4NSwibG9ja0dhbWVzIjpbXSwiYW1vdW50IjowLCJsb2NrQ2hhdCI6ZmFsc2UsInBob25lVmVyaWZpZWQiOmZhbHNlLCJpcEFkZHJlc3MiOiIxNC4xOTEuMTg0LjU1IiwibXV0ZSI6ZmFsc2UsImF2YXRhciI6Imh0dHBzOi8vaW1hZ2VzLnN3aW5zaG9wLm5ldC9pbWFnZXMvYXZhdGFyL2F2YXRhcl8xOC5wbmciLCJwbGF0Zm9ybUlkIjo0LCJ1c2VySWQiOiIzNDQ1MjY0ZC1kMzZhLTQ4NTItODczZC1kNjFiNTQzM2YyNDgiLCJyZWdUaW1lIjoxNzU2NjIxNjIxNTA4LCJwaG9uZSI6IiIsImRlcG9zaXQiOmZhbHNlLCJ1c2VybmFtZSI6IlNDX3R0cmJyYmdyYmcifQ.6uraHDIkBebvQDt12rntsFKSDrS9_ZtaVtdFZoCEbSg", {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Origin": "https://web.sunwin.ml"
    }
  });

  ws.on('open', () => {
    console.log('[✅] WebSocket kết nối');
    messagesToSend.forEach((msg, i) => {
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(msg));
        }
      }, i * 600);
    });

    pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 15000);
  });

  ws.on('pong', () => {
    console.log('[📶] Ping OK');
  });

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (Array.isArray(data) && typeof data[1] === 'object') {
        const cmd = data[1].cmd;

        if (cmd === 1008 && data[1].sid) {
          id_phien_chua_co_kq = data[1].sid;
        }

        if (cmd === 1003 && data[1].gBB) {
          const { d1, d2, d3 } = data[1];
          const total = d1 + d2 + d3;
          const result = total > 10 ? "T" : "X"; // Tài / Xỉu

          // Lưu pattern
          patternHistory.push(result);
          if (patternHistory.length > 20) patternHistory.shift();

          const text = `${d1}-${d2}-${d3} = ${total} (${result === 'T' ? 'Tài' : 'Xỉu'})`;

          // Dự đoán
          const du_doan = duDoanTiepTheo(patternHistory);

          currentData = {
            id: "@NguyenTung1920",
            phien: id_phien_chua_co_kq,
            xuc_xac_1: null,
            xuc_xac_2: null,
            xuc_xac_3: null,
            ket_qua: text,
            pattern: patternHistory.join(''),
            du_doan: du_doan === "T" ? "Tài" : du_doan === "X" ? "Xỉu" : "?",
            tong_dung: 0,
            tong_sai: 0,
          };

          console.log(`Phiên ${id_phien_chua_co_kq}: ${text} → Dự đoán tiếp: ${currentData.du_doan}`);
          id_phien_chua_co_kq = null;
        }
      }
    } catch (e) {
      console.error('[Lỗi]:', e.message);
    }
  });

  ws.on('close', () => {
    console.log('[🔌] WebSocket ngắt. Đang kết nối lại...');
    clearInterval(pingInterval);
    if (!isManuallyClosed) {
      reconnectTimeout = setTimeout(connectWebSocket, 2500);
    }
  });

  ws.on('error', (err) => {
    console.error('[❌] WebSocket lỗi:', err.message);
  });
}

// === API ===
app.get('/apisunwin', (req, res) => {
  res.json(currentData);
});

app.get('/', (req, res) => {
  res.send(`<h2>🎯 API SUNWIN</h2><p><a href="/taixiu">Xem kết quả JSON</a></p>`);
});

// === Khởi động server ===
app.listen(PORT, () => {
  console.log(`[🌐] Server chạy tại http://localhost:${PORT}`);
  connectWebSocket();
});
