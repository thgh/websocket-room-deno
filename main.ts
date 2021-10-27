import { Application, Router, Context } from "https://deno.land/x/oak/mod.ts";


const rooms = {}


// const router = new Router();

// Serve static content
const index =  Deno.readFile(`${Deno.cwd()}/index.html`);
const connectable =  Deno.readFile(`${Deno.cwd()}/connectable.js`);

console.log('index use')

const app = new Application();
// app.use(router.routes());
// app.use(router.allowedMethods());

app.use(async (ctx: Context) => {
  console.log('index')
  if (!ctx.isUpgradable) {
    console.log('index serve')
    if (ctx.request.pathname==='/connectable.js') {
      ctx.response.body = await connectable
    } else {
      ctx.response.body = await index
    }
    return
  }
  console.log('index alt')

  const roomName = ctx.request.url.pathname

  // Create room
  if (!rooms[roomName]) {
    console.log(roomName, 'create')
    rooms[roomName] = []
  }

  // Wait for open socket
  const socket:WebSocket = await ctx.upgrade()
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



app.addEventListener(
  "listen",
  (e) => console.log("Listening on http://localhost:8080"),
);
await app.listen({ port: 8080 });