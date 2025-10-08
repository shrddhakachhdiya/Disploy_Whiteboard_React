import { useState, useRef, useEffect } from "react";
import Whiteboard from "../../components/Whiteboard";
import Chat from "../../components/ChatBar";
import "./index.css";
import { toast, ToastContainer } from "react-toastify";
import UserWhiteBoard from "../../components/Whiteboard/UserWhiteBoard";
import { Pencil, LineSquiggle, CircleSmall, CaseUpper, RectangleHorizontal, Circle, Image, PaintBucket, Undo, Redo, Eraser, MessageCircle, HelpCircle } from 'lucide-react';
import { useParams, useSearchParams } from "react-router-dom";
import { v4 as uuidv4 } from 'uuid'



const RoomPage = ({ socket, users }) => {
  const [searchParams] = useSearchParams();
  const isHost = searchParams.get("host");
  const { roomid } = useParams()
  console.log("🚀 ~ RoomPage ~ isHost:", isHost)
  console.log("🚀 ~ RoomPage ~ roomid:", roomid)

  const user = {
    name:"Disploy",
    id:roomid,
    userId: uuidv4(),
    host:isHost,
    presenter:isHost
  }

  useEffect(() => {
    const userData = {
      name:'Disploy',
      id:roomid,
      userId: uuidv4(),
      host: isHost,
      presenter: isHost
    }

    socket.emit('user-joined', userData)
  }, [isHost])

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
  const [chat, setChat] = useState([])
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showImageSelector, setShowImageSelector] = useState(false);
  const [selectedElements, setSelectedElements] = useState([]);
  const [shouldSendCanvas, setShouldSendCanvas] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const isAdmin = user?.host;

  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const userBarRef = useRef(null);

  function handleClear() {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    setElements([]);
    setTool("pencil")
  }

  function handleUndo() {
    if (elements.length === 0) return;

    const lastElement = elements[elements.length - 1];

    setHistory((prevHistory) => [
      ...prevHistory,
      lastElement,
    ]);

    // If the last element was erased, restore it by removing the isErased flag
    if (lastElement.isErased) {
      setElements((prevElements) => {
        const newElements = [...prevElements];
        newElements[newElements.length - 1] = { ...lastElement };
        delete newElements[newElements.length - 1].isErased;
        return newElements;
      });
    } else {
      // Normal undo - remove the last element
      setElements((prevElements) =>
        prevElements.slice(0, prevElements.length - 1)
      );
    }
  }

  function handleRedo() {
    if (history.length === 0) return;

    setHistory((prevHistory) => prevHistory.slice(0, prevHistory.length - 1));
    setElements((prevElements) => [
      ...prevElements,
      history[history.length - 1],
    ]);
  }

  function handleDuplicate() {
    if (selectedElements.length === 0) {
      // If no elements are selected, duplicate the last drawn element
      if (elements.length === 0) return;

      const lastElement = elements[elements.length - 1];
      const duplicatedElement = {
        ...lastElement,
        offsetX: lastElement.offsetX + 20, // Offset the duplicate
        offsetY: lastElement.offsetY + 20,
      };

      setElements((prevElements) => [...prevElements, duplicatedElement]);
      clearHistoryOnNewAction();
    } else {
      // Duplicate selected elements
      const duplicatedElements = selectedElements.map(element => ({
        ...element,
        offsetX: element.offsetX + 20,
        offsetY: element.offsetY + 20,
      }));

      setElements((prevElements) => [...prevElements, ...duplicatedElements]);
      setSelectedElements(duplicatedElements);
      clearHistoryOnNewAction();
    }
  }

  function handleImageSelect(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImage(reader.result);
      reader.readAsDataURL(file);
    }
  }

  const clearHistoryOnNewAction = () => {
    if (history.length > 0) {
      setHistory([]);
    }
  };

  const sendCanvasData = () => {
    if (canvasRef.current && user?.presenter) {
      const canvas = canvasRef.current;
      const imageData = canvas.toDataURL();
      socket.emit("WhiteboardImage", imageData);
    }
  };

  function handleTextSubmit() {
    setElements((prevElements) => [
      ...prevElements,
      {
        type: "text",
        offsetX: 50,
        offsetY: 50,
        text: textInput,
        color,
      },
    ]);
    clearHistoryOnNewAction();
    setTextInput("");
    setIsTextInputOpen(false);
    setTool("")
  }

  function handleCancel() {
    setTextInput("");
    setIsTextInputOpen(false);
    setTool("")
  }

  useEffect(() => {
    socket.on("messageResponse", (data) => {
      setChat(prevChats => [...prevChats, { message: data.message, name: data.name }]);
      if (!openedChatBar) {
        toast.info(`${data.name} sent a message`)
      }
    })

    return () => socket.off("messageResponse")
  }, [openedChatBar])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!user?.presenter) return;

      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      else if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
      else if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        handleDuplicate();
      }
      else if (e.key === 'F1' || (e.ctrlKey && e.key === '?')) {
        e.preventDefault();
        setShowHelp(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [user?.presenter, elements, history, selectedElements]);


  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showColorPicker && !event.target.closest('.color-picker-container')) {
        setShowColorPicker(false);
        setTool("pencil")
      }
      if (showImageSelector && !event.target.closest('.image-selector-container')) {
        setShowImageSelector(false);
        setTool("pencil")
      }
      if (showHelp && !event.target.closest('.help-overlay')) {
        setShowHelp(false);
      }
    };

    if (showColorPicker || showImageSelector || showHelp) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showColorPicker, showImageSelector, showHelp]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (userBarRef.current && !userBarRef.current.contains(event.target)) {
        setOpenedUserBar(false);
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [setOpenedUserBar]);


  return (
    <div className="w-[100%] h-[100vh] flex flex-col justify-center items-center relative overflow-hidden">
      <ToastContainer />

      <div className="floating-buttons-container">
        <button
          onClick={() => setOpenedUserBar(true)}
          className={`floating-button ${openedUserBar ? 'active' : ''}`}
          title="View Online Users"
        >
          <span className="floating-button-icon">👥</span>
        </button>
        <button
          onClick={() => setOpenedChatBar(true)}
          className={`floating-button ${openedChatBar ? 'active' : ''}`}
          title="Open Chat"
        >
          <MessageCircle size={20} />
        </button>
        {user?.presenter && (
          <button
            onClick={() => setShowHelp(!showHelp)}
            className={`floating-button ${showHelp ? 'active' : ''}`}
            title="Keyboard Shortcuts (F1)"
          >
            <HelpCircle size={20} />
          </button>
        )}
      </div>

      <div className={`user-bar-container ${openedUserBar ? 'user-bar-open' : 'user-bar-closed'}`} ref={userBarRef}>
        <div className="user-bar-header">
          <div className="flex items-center space-x-3">
            <div className="user-bar-icon">
              👥
            </div>
            <div>
              <h3 className="user-bar-title">Online Users</h3>
              <p className="user-bar-subtitle">{users.length} users online</p>
            </div>
          </div>
          <button
            onClick={() => setOpenedUserBar(false)}
            className="user-bar-close-btn"
          >
            ✖
          </button>
        </div>

        <div className="user-bar-list">
          {users.length === 0 ? (
            <div className="empty-users">
              <p className="text-gray-500">No users online</p>
            </div>
          ) : (
            users.map((usr, index) => (
              <div key={index * 999} className="user-item">
                <div className="user-avatar">
                  {usr.name.charAt(0).toUpperCase()}
                </div>
                <div className="user-info">
                  <div className="user-name">
                    {usr.name}
                    {user && user.userId === usr.userId && (
                      <span className="you-badge">You</span>
                    )}
                  </div>
                  <div className="user-status">Online</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Chat setOpenedChatBar={setOpenedChatBar} socket={socket} chat={chat} setChat={setChat} openedChatBar={openedChatBar} />

      {showHelp && (
        <div
          className="help-overlay"
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 1000,
            backgroundColor: "white",
            borderRadius: "12px",
            padding: "24px",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
            width: "400px",
            maxWidth: "90vw",
            border: "1px solid #e0e0e0",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ margin: "0", fontSize: "18px", color: "#333", fontWeight: "600" }}>Keyboard Shortcuts</h3>
            <button
              onClick={() => setShowHelp(false)}
              style={{
                background: "none",
                border: "none",
                fontSize: "20px",
                cursor: "pointer",
                color: "#666",
                padding: "4px"
              }}
              title="Close"
            >
              ✖
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
              <span style={{ color: "#555", fontSize: "14px" }}>Undo</span>
              <kbd style={{
                backgroundColor: "#f5f5f5",
                padding: "4px 8px",
                borderRadius: "4px",
                fontSize: "12px",
                fontFamily: "monospace",
                border: "1px solid #ddd"
              }}>Ctrl + Z</kbd>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
              <span style={{ color: "#555", fontSize: "14px" }}>Redo</span>
              <kbd style={{
                backgroundColor: "#f5f5f5",
                padding: "4px 8px",
                borderRadius: "4px",
                fontSize: "12px",
                fontFamily: "monospace",
                border: "1px solid #ddd"
              }}>Ctrl + Y</kbd>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
              <span style={{ color: "#555", fontSize: "14px" }}>Duplicate Element</span>
              <kbd style={{
                backgroundColor: "#f5f5f5",
                padding: "4px 8px",
                borderRadius: "4px",
                fontSize: "12px",
                fontFamily: "monospace",
                border: "1px solid #ddd"
              }}>Ctrl + D</kbd>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
              <span style={{ color: "#555", fontSize: "14px" }}>Show/Hide Help</span>
              <kbd style={{
                backgroundColor: "#f5f5f5",
                padding: "4px 8px",
                borderRadius: "4px",
                fontSize: "12px",
                fontFamily: "monospace",
                border: "1px solid #ddd"
              }}>F1</kbd>
            </div>

            <hr style={{ margin: "12px 0", border: "none", borderTop: "1px solid #e0e0e0" }} />

            <div style={{ padding: "8px 0" }}>
              <span style={{ color: "#555", fontSize: "14px", fontWeight: "500" }}>Selection Tips:</span>
              <ul style={{ margin: "8px 0 0 16px", padding: "0", fontSize: "13px", color: "#666" }}>
                <li>Click on elements to select them</li>
                <li>Hold Ctrl while clicking to select multiple elements</li>
                <li>Selected elements will show a blue dashed border</li>
                <li>Use Ctrl+D to duplicate selected elements</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {isTextInputOpen && (
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
        <div className="flex items-center justify-center gap-4 p-2 rounded-xl mb-4 toolNav absolute bottom-1">
          <div className="flex gap-4 [&>div]:cursor-pointer">
            <div className={"text-white rounded-md p-3 " + (tool === "pencil" ? "toolShadow" : "")}>
              <div onClick={() => setTool("pencil")}><Pencil size={20} style={{ stroke: tool === "pencil" ? "white" : "black" }} /></div>
            </div>
            <div className={"text-white rounded-md p-3 " + (tool === "line" ? "toolShadow" : "")}>
              <div onClick={() => setTool("line")} ><LineSquiggle size={20} style={{ stroke: tool === "line" ? "white" : "black" }} /></div>
            </div>

            <div className={"text-white rounded-md p-3 " + (tool === "point" ? "toolShadow" : "")}>
              <div onClick={() => setTool("point")} ><CircleSmall size={20} style={{ fill: tool === "point" ? "white" : "black", stroke: tool === "point" ? "white" : "black" }} /></div>
            </div>
            <div className={"text-white rounded-md p-3 " + (tool === "text" ? "toolShadow" : "")}>
              <div onClick={() => { setTool("text"); setIsTextInputOpen(true) }}><CaseUpper size={20} style={{ stroke: tool === "text" ? "white" : "black" }} /></div>
            </div>
            <div className={"text-white rounded-md p-3 " + (tool === "rect" ? "toolShadow" : "")}>
              <div onClick={() => setTool("rect")}><RectangleHorizontal size={20} style={{ stroke: tool === "rect" ? "white" : "black" }} /></div>
            </div>
            <div className={"text-white rounded-md p-3 " + (tool === "circle" ? "toolShadow" : "")}>
              <div onClick={() => setTool("circle")}><Circle size={20} style={{ stroke: tool === "circle" ? "white" : "black" }} /></div>
            </div>
            <div className={"text-white rounded-md p-3 " + (tool === "eraser" ? "toolShadow" : "")}>
              <div onClick={() => setTool("eraser")}><Eraser size={20} style={{ stroke: tool === "eraser" ? "white" : "black" }} /></div>
            </div>
          </div>

          <div className={"relative color-picker-container rounded-md p-3 " + (tool === "color" ? "toolShadow" : "")}>
            <div onClick={() => setShowColorPicker((v) => !v)} style={{ cursor: "pointer" }}>
              <PaintBucket size={20} style={{ stroke: color }} />
            </div>
            {showColorPicker && (
              <div
                className="absolute bottom-9 left-0 z-50 p-2 rounded shadow-lg border bg-white"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="grid grid-cols-8 gap-1 w-40">
                  {[
                    '#000000', '#333333', '#666666', '#999999', '#CCCCCC', '#FFFFFF', '#FF0000', '#FF6600',
                    '#FFFF00', '#66FF00', '#00FF00', '#00FF66', '#00FFFF', '#0066FF', '#0000FF', '#6600FF',
                    '#FF00FF', '#FF0066', '#8B4513', '#A0522D', '#D2691E', '#CD853F', '#F4A460', '#DEB887',
                    '#FFA500', '#FFD700', '#ADFF2F', '#32CD32', '#00FA9A', '#00CED1', '#87CEEB', '#4169E1',
                    '#9370DB', '#DA70D6', '#FF69B4', '#DC143C', '#B22222', '#800000', '#8B0000', '#FF4500'
                  ].map((colorOption) => (
                    <div
                      key={colorOption}
                      className="w-5 h-5 cursor-pointer border border-gray-300 rounded"
                      style={{ backgroundColor: colorOption }}
                      onClick={() => {
                        setColor(colorOption);
                        socket.emit("colorChange", { color: colorOption });
                        setShowColorPicker(false);
                      }}
                      title={colorOption}
                    />
                  ))}
                </div>
                <div className="mt-2">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => {
                      setColor(e.target.value);
                      socket.emit("colorChange", { color: e.target.value });
                    }}
                    className="w-full h-8 border border-gray-300 rounded cursor-pointer"
                    title="Custom color"
                  />
                </div>
              </div>
            )}
          </div>

          <div className={"image-selector-container relative rounded-md p-2 " + (tool === "image" ? "toolShadow" : "")}>
            <div onClick={() => { setTool("image"); setShowImageSelector((v) => !v) }} style={{ cursor: "pointer" }}>
              <Image size={20} style={{ stroke: tool === "image" ? "white" : "black" }} />
            </div>
            {showImageSelector && (
              <div
                className="absolute bottom-9 left-0 w-[200px] z-50 bg-white p-4 rounded shadow-lg border"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-center">
                  <h4 className="text-sm font-medium mb-3 text-gray-700">Select Image</h4>
                  <label
                    htmlFor="image-upload"
                    className="block w-full p-3 bg-blue-500 text-white rounded cursor-pointer hover:bg-blue-600 transition-colors"
                  >
                    📁 Choose File
                  </label>
                  <input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      handleImageSelect(e);
                      setShowImageSelector(false);
                    }}
                    className="hidden"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              className={"undo rounded-md p-2 cursor-pointer " + (tool === "undo" ? "toolShadow" : "")}
              onClick={handleUndo}
              disabled={elements.length === 0}
            >
              <Undo size={20} />
            </button>
            <button
              className={"redo rounded-md p-2 cursor-pointer " + (tool === "redo" ? "toolShadow" : "")}
              onClick={handleRedo}
              disabled={history.length === 0}
            >
              <Redo size={20} />
            </button>
          </div>

          <div>
            <button
              className=" bg-red-500 rounded-md p-2 clear"
              onClick={handleClear}
            >
              Clear Canvas
            </button>
          </div>
        </div>
      )}
      {user?.presenter &&
        <Whiteboard
          canvasRef={canvasRef}
          ctxRef={ctxRef}
          elements={elements}
          setElements={setElements}
          clearHistoryOnNewAction={clearHistoryOnNewAction}
          shouldSendCanvas={shouldSendCanvas}
          setShouldSendCanvas={setShouldSendCanvas}
          tool={tool}
          color={color}
          fontSize={fontSize}
          fontFamily={fontFamily}
          backgroundColor={backgroundColor}
          image={image}
          setColor={setColor}
          socket={socket}
          user={user}
          sendCanvasData={sendCanvasData}
          selectedElements={selectedElements}
          setSelectedElements={setSelectedElements}
        />
      }

      {!user?.presenter &&
        <UserWhiteBoard
          socket={socket}
          user={user}
          ctxRef={ctxRef}
          elements={elements}
          setElements={setElements}
          color={color}
          setColor={setColor}
        />
      }
    </div>
  );
};

export default RoomPage;
