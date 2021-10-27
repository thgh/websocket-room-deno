import { Application, Router } from "https://deno.land/x/oak/mod.ts";


const rooms = {}


const router = new Router();
router.get("/", (ctx) => {
  ctx.response.body = "Hello world!";
});
router.get("/ws", async (ctx) => {
  ctx.response.body = "Cool " + ctx.url;
  const roomName = ctx.request.url.pathname

  // Create room
  if (!rooms[roomName]) {
    console.log(roomName, 'create')
    rooms[roomName] = []
  }

  const socket:WebSocket = await ctx.upgrade()
  // Wait for open socket
  await new Promise(res => {
    socket.addEventListener('open', res)
  })

  // Save for later
  rooms[roomName].push(socket)
  console.log(roomName, rooms[roomName].length, 'subs')

  // Broadcast messages
  socket.addEventListener('message', (evt) => {
    console.log(roomName, 'message', evt.data.slice(0, 80))
    rooms[roomName].forEach(s => {
      if (socket !== s) {
        socket.send(evt.data)
      }
    })
  })

  socket.addEventListener('close', function() {
    console.log(roomName, rooms[roomName].length, 'subs', rooms[roomName].map(s => s.readyState))
    rooms[roomName] = rooms[roomName].filter(s => s !== socket)
    console.log(roomName, rooms[roomName].length, 'subs', rooms[roomName].map(s => s.readyState))
    rooms[roomName] = rooms[roomName].filter(s => s !== socket && s.readyState !== WebSocket.CLOSED)
    console.log(roomName, rooms[roomName].length, 'subs')
    // cleanup room
    if (!rooms[roomName].length) {
      console.log(roomName, 'delete')
      delete rooms[roomName]
    }
  })
});



const app = new Application();
app.use(router.routes());
app.use(router.allowedMethods());

app.addEventListener(
  "listen",
  (e) => console.log("Listening on http://localhost:8080"),
);
await app.listen({ port: 8080 });