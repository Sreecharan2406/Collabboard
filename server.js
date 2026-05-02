const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.resolve(process.cwd(), 'public')));

app.get('/room/:roomId', (req, res) => {
  res.sendFile(path.resolve(process.cwd(), 'public', 'index.html'));
});

app.post('/api/snap-shape', async (req, res) => {
  try {
    const { imageData } = req.body;
    if (!imageData) return res.status(400).json({ error: 'No image data' });

    const base64 = imageData.replace(/^data:image\/\w+;base64,/, '');

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + process.env.GEMINI_API_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                inline_data: { mime_type: 'image/png', data: base64 }
              },
              {
                text: `This image shows a hand-drawn shape in black on a white background. 
Look carefully at the overall outline and silhouette of the drawing.
You must classify it as exactly ONE of these: rectangle, circle, triangle, line, arrow.

Rules:
- If it looks like any 4-sided closed shape (square, box, rounded rectangle) → rectangle
- If it looks like a round or oval closed shape → circle  
- If it looks like a 3-sided shape with a point → triangle
- If it looks like a straight or curved single stroke with no arrowhead → line
- If it looks like a line with a pointed tip or arrowhead → arrow

Reply with ONLY the single word. No punctuation. No explanation.`
              }
            ]
          }],
          generationConfig: { temperature: 0, maxOutputTokens: 10 }
        })
      }
    );

    const data = await response.json();
    console.log('FULL Gemini response:', JSON.stringify(data, null, 2));

    if (data.error) {
      console.error('Gemini API error:', data.error);
      return res.json({ shape: 'circle', error: data.error.message });
    }

    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase() || '';
    console.log('Detected shape text:', raw);

    const validShapes = ['rectangle', 'circle', 'triangle', 'line', 'arrow'];
    const detected = validShapes.find(s => raw.includes(s)) || 'circle';

    res.json({ shape: detected });
  } catch (err) {
    console.error('AI error:', err);
    res.status(500).json({ error: 'AI failed', shape: 'circle' });
  }
});

io.on('connection', (socket) => {
  socket.on('join-room', (room) => { socket.join(room); });
  socket.on('draw', (data) => { socket.to(data.room).emit('draw', data); });
  socket.on('cursor-move', (data) => { socket.to(data.room).emit('cursor-move', data); });
  socket.on('cursor-idle', (data) => { socket.to(data.room).emit('cursor-idle', data); });
  socket.on('confetti', (data) => { socket.to(data.room).emit('confetti', data); });
});

server.listen(3000, () => { console.log('CollabBoard running at http://localhost:3000'); });
