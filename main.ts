import { Application, Router, Context } from "https://deno.land/x/oak/mod.ts";
import { throttle } from './throttle.ts'

const rooms = {}

const region = Deno.env.get("DENO_REGION")
const channel = new BroadcastChannel('main');

// Serve static content
const index = Deno.readTextFile(`${Deno.cwd()}/index.html`);
const connectable = Deno.readTextFile(`${Deno.cwd()}/connectable.js`);

// Listen to other regions
channel.onmessage = (evt) => {
  const { data, roomName, region } = evt.data

  // Broadcast external messages to this region
  rooms[roomName]?.forEach(peer => {
    peer.debounced(data)
    // peer.socket.send(data)
  })
}
// channel.addEventListener('message', (evt) => {
//   console.log(region, 'received', evt.data)
//   const { data, roomName, region } = evt.data

//   // Broadcast external messages to this region
//   rooms[roomName].forEach(peer => {
//     peer.socket.send(data)
//   })
// })

// Listen to clients
const app = new Application();
app.use(async (ctx: Context) => {
  if (!ctx.isUpgradable) {
    if (ctx.request.url.pathname === '/connectable.js') {
      ctx.response.type = 'application/javascript'
      ctx.response.body = await connectable
    } else {
      ctx.response.body = String(await index).replaceAll('Listening', 'Listening in ' + region)
    }
    return
  }

  const roomName = ctx.request.url.pathname

  // Create room
  if (!rooms[roomName]) {
    console.log(region, roomName, 'create')
    rooms[roomName] = []
  }

  // Wait for open socket
  const socket: WebSocket = await ctx.upgrade()
  await new Promise(res => {
    socket.addEventListener('open', res)
  })

  // Save for later
  rooms[roomName].push({ socket, debounced: throttle(socket.send, 500) })

  // Broadcast messages
  socket.addEventListener('message', (evt) => {
    console.log(region, roomName, rooms[roomName].length, 'message', evt.data.slice(0, 80))

    // This region
    rooms[roomName].forEach(peer => {
      if (socket !== peer.socket) {
        peer.socket.send(evt.data)
        // peer.debounced(evt.data)
      }
    })

    // Other regions
    channel.postMessage({ region, roomName, data: evt.data })
  })

  socket.addEventListener('close', function () {
    rooms[roomName] = rooms[roomName].filter(s => s.socket !== socket)
    rooms[roomName] = rooms[roomName].filter(s => s.readyState !== WebSocket.CLOSED)
    console.log(region, roomName, rooms[roomName].length, 'subs')
    // cleanup room
    if (!rooms[roomName].length) {
      console.log(region, roomName, 'delete')
      delete rooms[roomName]
    }
  })
});



app.addEventListener(
  "listen",
  (e) => console.log(region, "Listening on http://localhost:8080"),
);
await app.listen({ port: 8080 });