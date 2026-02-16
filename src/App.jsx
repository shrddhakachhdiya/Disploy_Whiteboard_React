import LandingPage from "./pages/LandingPage/"
import './App.css'
import CreateRoom from "./components/Forms/CreateRoom"
import JoinRoom from "./components/Forms/JoinRoom"
import RoomPage from "./pages/RoomPage"
import { Routes, Route, useParams, useSearchParams } from "react-router-dom"
import io from "socket.io-client"
import { useState, useEffect } from "react"
import { ToastContainer, toast } from "react-toastify"
// import { Container } from "./components/Container"
import { useCallback } from "react"

//start both nodemon server.js and yarn run dev on diff terminals to start this

const server = "https://disploy-whiteboard-node-nyxk.onrender.com";
// const server = "http://localhost:5000";

const connectionOptions = {
  reconnection: true,
  reconnectionAttempts: Infinity,
  timeout: 20000,
};


const socket = io(server, connectionOptions)

function App() {


  const [user, setUser] = useState(null)
  const [users, setUsers] = useState([])

  // useEffect(() => {
  //   const fetchUserDetails = (data) => {
  //     console.log("🚀 ~ fetchUserDetails ~ data:", data)
  //   }
  //       socket.on("userLeftMessageBroadcasted", fetchUserDetails)
  // }, [])

  useEffect(() => {
    socket.on("connect", () => {
      console.log("✅ Socket connected");
    });

    socket.on("connect_error", (err) => {
      console.log("❌ Socket error:", err.message);
    });
  }, []);


  const handleRoomJoined = (data) => {
    if (data.success) {
      setUsers(data.users)
    }
    else {
      console.log("something went wrong")
    }
  }

  const handleAllUsers = (data) => {
    setUsers(data);
  }

  // const handleUserJoinedMessage = useCallback((data) => {
  //   toast.info(`${data} joined the room`)
  // }, [])

  const handleUserLeftMessage = useCallback((data) => {
    console.log("🚀 ~ App ~ data:", data)
    console.log('testing data')

    toast.info(`${data.name} left the room`)
  }, [])

  const fetchUserDetails = (data) => {
    console.log('testing data')
    console.log("🚀 ~ fetchUserDetails ~ data:", data)

  }

  useEffect(() => {
    // socket.on("userLeftMessageBroadcasted", fetchUserDetails)
    socket.on("room-joined", handleRoomJoined)
    socket.on("allUsers", handleAllUsers)
    // socket.on("userJoinedMessageBroadcasted", handleUserJoinedMessage)
    socket.on("userLeftMessageBroadcasted", handleUserLeftMessage)

    // Cleanup function to remove event listeners
    return () => {
      socket.off("room-joined", handleRoomJoined)
      socket.off("allUsers", handleAllUsers)
      // socket.off("userJoinedMessageBroadcasted", handleUserJoinedMessage)
      socket.off("userLeftMessageBroadcasted", handleUserLeftMessage)
    }
  }, [])

  return (
    <>
      {/* <Container/> */}
      <ToastContainer />
      <Routes>
        {/* <Route path="/" element={<LandingPage/>}/> */}
        <Route path="/" element={<CreateRoom socket={socket} setUser={setUser} />} />
        <Route path="/join-room" element={<JoinRoom socket={socket} setUser={setUser} />} />
        <Route path="/:roomid" element={<RoomPage user={user} socket={socket} users={users} />} />
      </Routes>
    </>
  )
}

export default App
