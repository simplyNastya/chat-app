import express from 'express'
import { Server } from 'socket.io'
import path from 'path'
import { fileURLToPath } from 'url'

const PORT = process.env.PORT || 3500
const ADMIN = 'Admin'

const app = express()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

app.use(express.static(path.join(__dirname, 'public')))

const expressServer = app.listen(PORT, () => console.log(`Listenning on port ${PORT}`))

const UsersState = {
    users: [],
    setUsers: function (newUsersArray) {
        this.users = newUsersArray
    }
}


const io = new Server(expressServer, {
    cors: {
        origin: process.env.NODE.ENV === 'production' ? false : ['http://localhost:5500', 'http://127.0.0.1:5500']
    }
})

io.on('connection', socket => {
    console.log(`User ${socket.id} connected`)

    // Upon connection - only user
    socket.emit('message', bldMsg(ADMIN, 'Welcome to Chat App'))

    socket.on('enterRoom', ({ name, room }) => {
        //leave previous room
        const prevRoom = getUser(socket.id)?.room

        if (prevRoom) {
            socket.leave(prevRoom)
            io.to(prevRoom).emit('message', bldMsg(ADMIN, `${name} has left the room`))
        }

        const user = activateUser(socket.id, name, room)

        //Cannot update previous room user list until after the state update in activate user 
        if (prevRoom) {
            io.to(prevRoom).emit('userList', {
                users: getUsersInRoom(prevRoom)
            })
        }

        // join room
        socket.join(user.room)

        //To user who joined 
        socket.emit('message', bldMsg(ADMIN, `You have joined the ${user.room} chat room`))
        socket.broadcast.to(user.room).emit('message', bldMsg(ADMIN, `${user.name} has joined the room`))

        //Update user list for room
        io.to(user.room).emit('userList', {
            users: getUsersInRoom(user.room)
        })

        //update room list for all
        io.emit('roomList', {
            rooms: getAllActiveRooms( )
        })
    })

    //When user disconect - to all users
    socket.on('disconnect', () => {
        const user = getUser(socket.id)
        userLeavesApp(socket.id)

        if (user) {
            io.to(user.room).emit('message', bldMsg(ADMIN, `${user.name} has left the room`))

            io.to(user.room).emit('userList', {
                users: getUsersInRoom(user.room)
            })

            io.emit('roomList', {
                rooms: getAllActiveRooms()
            })
        }

        console.log(`User ${socket.id} disconnected`)

    })

    //Listen to a message event
    socket.on('message', ({ name, text }) => {
        const room = getUser(socket.id)?.room

        if (room) {
            io.to(room).emit('message', bldMsg(name, text))
        }
    })

    //Listen for activity 
    socket.on('activity', (name) => {
        const room = getUser(socket.id)?.room
        if (room) {
            socket.broadcast.to(room).emit('activity', name)
        }
    })
    
})
//
function bldMsg(name, text) {
    return {
        name,
        text,
        time: new Intl.DateTimeFormat('default', {
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric'
        }).format(new Date())
    }
}

//User functions
function activateUser(id, name, room) {
    const user = { id, name, room }
    UsersState.setUsers([
        ...UsersState.users.filter(user => user.id !== id),
        user
    ])
    return user
}

function userLeavesApp(id) {
    UsersState.setUsers(
        UsersState.users.filter(user => user.id !== id)
    )
}

function getUser(id) {
    return UsersState.users.find(user => user.id === id)
}

function getUsersInRoom(room) {
    return UsersState.users.filter(user => user.room === room)
}

function getAllActiveRooms() {
    return Array.from(new Set(UsersState.users.map(user => user.room)))
}

console.log(UsersState.users)