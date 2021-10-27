import { Application, Router, Context } from "https://deno.land/x/oak/mod.ts";


const rooms = {}

const region = Deno.env.get("DENO_REGION")
const channel = new BroadcastChannel('main');

// Serve static content
const index = Deno.readTextFile(`${Deno.cwd()}/index.html`);
const connectable = Deno.readTextFile(`${Deno.cwd()}/connectable.js`);

console.log('index use')

// app.use(router.routes());
// app.use(router.allowedMethods());




// Listen to other regions
channel.onmessage = (evt) => {
  console.log('received', evt.data)
  const { data, roomName, region } = evt.data

  // Broadcast external messages to this region
  rooms[roomName].forEach(peer => {
    peer.socket.send(data)
  })
}
// channel.addEventListener('message', (evt) => {
//   console.log('received', evt.data)
//   const { data, roomName, region } = evt.data

//   // Broadcast external messages to this region
//   rooms[roomName].forEach(peer => {
//     peer.socket.send(data)
//   })
// })

// Listen to clients
const app = new Application();
se(async (ctx: Context) => {
  console.log('index')
  if (!ctx.isUpgradable) {
    console.log('index serve', ctx.request.pathname)
    if (ctx.request.url.pathname === '/connectable.js') {
      ctx.response.type = 'application/javascript'
      ctx.response.body = await connectable
    } else {
      ctx.response.body = String(await index).replaceAll('Listening', 'Listening in ' + region)
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
  const socket: WebSocket = await ctx.upgrade()
  await new Promise(res => {
    socket.addEventListener('open', res)
  })

  // Save for later
  rooms[roomName].push({ socket })
  console.log(roomName, rooms[roomName].length, 'subs')

  // Broadcast messages
  socket.addEventListener('message', (evt) => {
    console.log(roomName, 'message', evt.data.slice(0, 80))

    // This region
    rooms[roomName].forEach(peer => {
      if (socket !== peer.socket) {
        peer.socket.send(evt.data)
      }
    })

    // Other regions
    channel.postMessage({ region, roomName, data: evt.data })
  })

  socket.addEventListener('close', function () {
    console.log(roomName, rooms[roomName].length, 'subs', rooms[roomName].map(s => s.socket.readyState))
    rooms[roomName] = rooms[roomName].filter(s => s.socket !== socket)
    console.log(roomName, rooms[roomName].length, 'subs', rooms[roomName].map(s => s.socket.readyState))
    rooms[roomName] = rooms[roomName].filter(s => s.socket !== socket && s.readyState !== WebSocket.CLOSED)
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