import { useState, useRef, useEffect } from "react";
import Whiteboard from "../../components/Whiteboard";
import Chat from "../../components/ChatBar";
import "./index.css";
import { useLocation } from "react-router-dom";

const RoomPage = ({ user, socket, users }) => {
  const [tool, setTool] = useState("pencil");
  const [color, setColor] = useState("#000000");
  const [elements, setElements] = useState([]);
  const [history, setHistory] = useState([]);
  const [fontSize, setFontSize] = useState(16);
  const [fontFamily, setFontFamily] = useState("Arial");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [openedUserBar, setOpenedUserBar] = useState(false);
  const [openedChatBar, setOpenedChatBar] = useState(false);
  const [image, setImage] = useState(null);
  const [isTextInputOpen, setIsTextInputOpen] = useState(false);
    const [textInput, setTextInput] = useState("");
  console.log("isTextInputOpen ==> ::::::::::::::::::::::", isTextInputOpen);

  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const isAdmin = params.get("isAdmin");

  const canvasRef = useRef(null);
  const ctxRef = useRef(null);

  function handleClear() {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    setElements([]);
    setTool("pencil")
  }

  function handleUndo() {
    setHistory((prevHistory) => [
      ...prevHistory,
      elements[elements.length - 1],
    ]);
    setElements((prevElements) =>
      prevElements.slice(0, prevElements.length - 1)
    );
    if (elements.length === 1) handleClear();
  }

  function handleRedo() {
    setHistory((prevHistory) => prevHistory.slice(0, prevHistory.length - 1));
    setElements((prevElements) => [
      ...prevElements,
      history[history.length - 1],
    ]);
  }

  function handleImageSelect(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImage(reader.result);
      reader.readAsDataURL(file);
    }
  }

  function handleTextSubmit() {
    setElements((prevElements) => [
      ...prevElements,
      {
        type: "text",
        offsetX: 50, // Set desired X position
        offsetY: 50, // Set desired Y position
        text: textInput,
        color,
      },
    ]);
    setTextInput(""); // Clear input after submit
    setIsTextInputOpen(false);
    setTool("")
  }

  // Handle cancel
  function handleCancel() {
    setTextInput(""); // Clear input
    setIsTextInputOpen(false); // Close the input popup
    setTool("")
  }

  return (
    <div className="bg-purple-800 w-[100%] h-[100vh] flex flex-col justify-center items-center">
      <div className="flex justify-start my-8">
        <button
          onClick={() => setOpenedUserBar(true)}
          className="mx-2 bg-white shadow-lg rounded-md px-2 py-1"
        >
          Users
        </button>
        <button
          onClick={() => setOpenedChatBar(true)}
          className="mx-2 bg-white shadow-lg rounded-md px-2 py-1"
        >
          Chat
        </button>
        <div className="tracking-wide text-2xl text-white">
          Welcome to the whiteboard sharing app
        </div>
      </div>
      {openedUserBar && (
        <div
          style={{
            height: "100vh",
            width: "250px",
            position: "fixed",
            top: "0",
            left: "0",
            backgroundColor: "white",
            color: "white",
          }}
          className="shadow-lg"
        >
          <button
            onClick={() => setOpenedUserBar(false)}
            className="p-2 w-[2em] h-[2em] text-center items-center flex text-black absolute"
          >
            ✖
          </button>
          <div style={{ color: "black" }}>
            {users.map((usr, index) => (
              <p key={index * 999}>
                {usr.name}
                {user && user.userId === usr.userId && " (You)"}
              </p>
            ))}
          </div>
        </div>
      )}

      {openedChatBar && (
        <Chat setOpenedChatBar={setOpenedChatBar} socket={socket} />
      )}
      {isTextInputOpen &&(
       <div
       style={{
         position: "fixed",
         top: "50%",
         left: "50%",
         transform: "translate(-50%, -50%)",
         zIndex: 1000,
         backgroundColor: "white",
         borderRadius: "8px",
         padding: "20px",
         boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
         width: "300px",
         textAlign: "center",
       }}
     >
       <h3 style={{ marginBottom: "10px", fontSize: "16px" }}>Enter Text</h3>
       
       <input
        type="text"
        value={textInput}
        onChange={(e) => setTextInput(e.target.value)}
        placeholder="Type your text here"
        style={{
          padding: "8px",
          fontSize: "16px",
          borderRadius: "4px",
          border: "1px solid #ddd",
          width: "100%",
          marginBottom: "10px",
          boxSizing: "border-box",
        }}
      />
      <div>
        <button
          onClick={handleTextSubmit}
          style={{
            padding: "8px 12px",
            marginRight: "10px",
            backgroundColor: "#4CAF50",
            border: "none",
            color: "white",
            fontSize: "14px",
            cursor: "pointer",
            borderRadius: "4px",
          }}
          aria-label="Submit text"
        >
          Submit
        </button>
        <button
          onClick={handleCancel}
          style={{
            padding: "8px 12px",
            backgroundColor: "#f44336",
            border: "none",
            color: "white",
            fontSize: "14px",
            cursor: "pointer",
            borderRadius: "4px",
          }}
          aria-label="Cancel text input"
        >
          Cancel
        </button>
      </div>
       </div>
      )

      }

      {isAdmin && (
        <div className="flex p-2">
          <div className="flex">
            <div className="mx-2 text-white">
              <input
                type="radio"
                id="pencil"
                name="tool"
                checked={tool === "pencil"}
                value="pencil"
                onChange={(e) => setTool(e.target.value)}
              />
              <label htmlFor="pencil">Pencil</label>
            </div>
            <div className="mx-2 text-white">
              <input
                type="radio"
                id="line"
                name="tool"
                value="line"
                checked={tool === "line"}
                onChange={(e) => setTool(e.target.value)}
              />
              <label htmlFor="line">Line</label>
            </div>
            <div className="mx-2 text-white">
              <input
                type="radio"
                id="point"
                name="point"
                checked={tool === "point"}
                value="point"
                onChange={(e) => setTool(e.target.value)}
              />
              <label htmlFor="point">point</label>
            </div>
            <div className="mx-2 text-white">
              <input
                type="radio"
                id="text"
                name="text"
                checked={tool === "text"}
                value="text"
                onChange={(e) => (setTool(e.target.value) ,setIsTextInputOpen (true))}
              />
              <label htmlFor="text">Text</label>
            </div>
            <div className="mx-2 text-white">
              <input
                type="radio"
                id="rectangle"
                name="tool"
                checked={tool === "rect"}
                value="rect"
                onChange={(e) => setTool(e.target.value)}
              />
              <label htmlFor="rectangle">Rectangle</label>
            </div>
            <div className="mx-2 text-white">
              <input
                type="radio"
                id="cricle"
                name="tool"
                value="cricle"
                checked={tool === "cricle"}
                onChange={(e) => setTool(e.target.value)}
              />
              <label htmlFor="cricle">cricle</label>
            </div>
          </div>

          <div className="mx-2">
            <input
              type="color"
              name="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </div>
          <div className="image-upload-section">
            <input
              type="radio"
              id="image"
              name="image"
              checked={tool === "image"}
              value="image"
              onChange={(e) => setTool(e.target.value)}
            />
            <label htmlFor="image">Upload Image</label>

           {tool === "image" && <input
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="mx-2"
            />}
          </div>
          <div>
            <button
              className="undo mx-2 bg-white shadow-lg rounded-md px-2 py-1"
              onClick={handleUndo}
              disabled={elements.length === 0}
            >
              Undo
            </button>
            <button
              className=" mx-2 bg-white shadow-lg rounded-md px-2 py-1 redo"
              onClick={handleRedo}
              disabled={history.length === 0}
            >
              Redo
            </button>
          </div>

          <div>
            <button
              className="mx-2 bg-red-500 shadow-lg rounded-md px-2 py-1 clear"
              onClick={handleClear}
            >
              Clear Canvas
            </button>
          </div>
        </div>
      )}

      <Whiteboard
        canvasRef={canvasRef}
        ctxRef={ctxRef}
        elements={elements}
        setElements={setElements}
        tool={tool}
        color={color}
        fontSize={fontSize}
        fontFamily={fontFamily}
        backgroundColor={backgroundColor}
        image={image}
        setColor={setColor}
        socket={socket}
        user={user}
      />
    </div>
  );
};

export default RoomPage;
