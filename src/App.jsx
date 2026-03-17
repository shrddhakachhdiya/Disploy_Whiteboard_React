import LandingPage from "./pages/LandingPage/"
import './App.css'
import CreateRoom from "./components/Forms/CreateRoom"
import JoinRoom from "./components/Forms/JoinRoom"
import RoomPage from "./pages/RoomPage"
import { Routes, Route, useParams, useSearchParams, useNavigate,useLocation } from "react-router-dom"
import io from "socket.io-client"
import { useState, useEffect } from "react"
import { ToastContainer, toast } from "react-toastify"
// import { Container } from "./components/Container"
import { useCallback } from "react"

//start both nodemon server.js and yarn run dev on diff terminals to start this

const server = import.meta.env.VITE_SOCKET_SERVER_URL || (window.location.hostname === "localhost"
  ? "http://localhost:5000"
  : "https://disploy-whiteboard-node-nyxk.onrender.com");

const connectionOptions = {
  reconnection: true,
  reconnectionAttempts: Infinity,
  timeout: 20000,
  transports: ["websocket"],
};


const socket = io(server, connectionOptions)

function App() {

  const navigate = useNavigate()
  const location = useLocation()


  const [user, setUser] = useState(null)
  const [users, setUsers] = useState([])

    useEffect(() => {
    const roomid = location.pathname.replace("/", "");
    if (!roomid ) {
      window.location.replace("https://web.disploy.com/");
    } 
  }, [location]);

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


  const handleRoomJoined = useCallback((data) => {
    if (data.success) {
      setUsers(data.users)
    }
    else {
      console.log("something went wrong")
    }
  }, [])

  // const handleUserJoinedMessage = useCallback((data) => {
  //   toast.info(`${data} joined the room`)
  // }, [])

  const handleUserLeftMessage = useCallback((data) => {
    const leftUserName = data?.name || "A user"
    toast.info(`${leftUserName} left the room`)

    if (data?.userId) {
      setUsers((prevUsers) => prevUsers.filter((usr) => usr.userId !== data.userId))
    }
  }, [])

  const handleNoHostAvailable = useCallback((data) => {
    console.log("🚀 ~ handleNoHostAvailable ~ data:", data)
    toast.info(`${data.message}`)
  }, [])

  const handleAllUsers = useCallback((data) => {
    setUsers(Array.isArray(data) ? data : [])
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
    socket.on("no-host-available", handleNoHostAvailable)

    // Cleanup function to remove event listeners
    return () => {
      socket.off("room-joined", handleRoomJoined)
      socket.off("allUsers", handleAllUsers)
      // socket.off("userJoinedMessageBroadcasted", handleUserJoinedMessage)
      socket.off("userLeftMessageBroadcasted", handleUserLeftMessage)
      socket.off("no-host-available", handleNoHostAvailable)
    }
  }, [handleAllUsers, handleNoHostAvailable, handleRoomJoined, handleUserLeftMessage])

  return (
    <>
      {/* <Container/> */}
      <ToastContainer />
      <Routes>
        {/* <Route path="/" element={<LandingPage/>}/> */}
        <Route path="/" element={<CreateRoom socket={socket} setUser={setUser} />} />
        <Route path="/join-room" element={<JoinRoom socket={socket} setUser={setUser} />} />
        <Route path="/:roomid" element={<RoomPage user={user} socket={socket} users={users} setUsers={setUsers} />} />
      </Routes>
    </>
  )
}

export default App
