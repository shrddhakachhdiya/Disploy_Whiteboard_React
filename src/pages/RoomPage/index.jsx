import { useState, useRef, useEffect } from "react";
import Whiteboard from "../../components/Whiteboard";
import Chat from "../../components/ChatBar";
import "./index.css";
import { toast, ToastContainer } from "react-toastify";
import UserWhiteBoard from "../../components/Whiteboard/UserWhiteBoard";
import { Pencil, LineSquiggle, CircleSmall, CaseUpper, RectangleHorizontal, Circle, Image, PaintBucket, Undo, Redo, Eraser, MessageCircle, HelpCircle, Move, Minus, Plus, Download } from 'lucide-react';
import { useParams, useSearchParams } from "react-router-dom";
import { v4 as uuidv4 } from 'uuid'
import axios from "axios";
import { Tooltip } from "react-tooltip";
import "react-tooltip/dist/react-tooltip.css";



const RoomPage = ({ socket, users }) => {
  const [searchParams] = useSearchParams();
  const { roomid } = useParams()

  // Determine host status: URL param takes priority, then localStorage
  const hostParam = searchParams.get("host");
  let isHost = false;

  if (hostParam === 'true') {
    // First visit with ?host=true — store in localStorage and strip from URL
    isHost = true;
    localStorage.setItem("whiteboard_host", JSON.stringify({ host: true, roomId: roomid }));
    // Remove ?host=true from URL so user can't modify it
    const url = new URL(window.location.href);
    url.searchParams.delete("host");
    window.history.replaceState({}, '', url.pathname);
  } else {
    // Check localStorage for host status
    try {
      const stored = JSON.parse(localStorage.getItem("whiteboard_host"));
      if (stored && stored.host === true && stored.roomId === roomid) {
        isHost = true;
      }
    } catch (e) {
      // Invalid localStorage data, ignore
    }
  }

  const user = {
    name: isHost ? "Disploy" : "User",
    id: roomid,
    userId: uuidv4(),
    host: isHost,
    presenter: isHost
  }

  // On mount, check if this is a reload — if so, redirect to web.disploy.com
  useEffect(() => {
    if (sessionStorage.getItem("whiteboard_reloading")) {
      sessionStorage.removeItem("whiteboard_reloading");
      localStorage.removeItem("whiteboard_host");
      localStorage.removeItem("whiteboard_macids");
      window.location.href = "https://web.disploy.com";
      return;
    }
  }, []);

  useEffect(() => {
    const userData = {
      name: isHost ? 'Disploy' : 'User',
      id: roomid,
      userId: uuidv4(),
      host: isHost,
      presenter: false
    }

    socket.emit('user-joined', userData)

    // If host, fetch macIds from API, store in localStorage, and send to server
    if (isHost) {
      axios.get(`https://back.disploy.com/api/WhiteBoardMaster/GetWhiteBoardMacIDs?code=${roomid}`)
        .then((res) => {
          console.log("🚀 ~ Fetched macIds response:", res?.data)
          const macIds = res?.data?.data?.maciDs || "";
          console.log("🚀 ~ Fetched macIds:", macIds);
          localStorage.setItem("whiteboard_macids", JSON.stringify(macIds));
          // Send macIds to server so it can use them on disconnect
          socket.emit('store-macids', { roomId: roomid, macIds: macIds });
        })
        .catch((error) => {
          console.error("❌ Error fetching macIds:", error);
        });
    }

    // Set reload flag on beforeunload & clean up localStorage (only for host)
    const handleBeforeUnload = () => {
      if (isHost) {
        sessionStorage.setItem("whiteboard_reloading", "true");
      }
      localStorage.removeItem("whiteboard_host");
      localStorage.removeItem("whiteboard_macids");
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isHost])

  const handleAllUsers = (data) => {
    console.log("🚀 ~ handleAllUsers ~ user:", data)
    const host = data.some(user => user.host === true);
    console.log("🚀 ~ handleAllUsers ~ host:", host)
    if (!host) {
      console.log(`⚠️ No host found in room ${roomid}. Redirecting to homepage...`);
      if (user && user?.id) {
        console.log("🚀 ~ handleAllUsers ~ user before code removal:", user)
        const UserCode = user?.id
        axios.post('https://back.disploy.com/api/WhiteBoardMaster/RemoveWhiteBoardScreenCode', {
          code: UserCode
        }).then((res) => {
          console.log("🚀 ~ remove code res:", res?.data)
        }).catch(error => {
          console.error('Error removing whiteboard screen code:', error);
        });
      }
    } else {
      setUsers(data)
    }
  }

  useEffect(() => {
    socket.on("allUsers", handleAllUsers)

    return () => {
      socket.off("allUsers", handleAllUsers)
    }
  }, [])

  const [tool, setTool] = useState("move");
  const [color, setColor] = useState("#000000");
  const [elements, setElements] = useState([]);
  const [history, setHistory] = useState([]);
  
  // Memory limits - Increased for better performance
  const MAX_ELEMENTS = 10000; // Increased from 5000
  const MAX_HISTORY = 100;
  const MAX_IMAGE_ELEMENTS = 100; // Maximum number of images allowed

  const [fontSize, setFontSize] = useState(16);
  const [fontFamily, setFontFamily] = useState("Arial");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [openedUserBar, setOpenedUserBar] = useState(false);
  const [openedChatBar, setOpenedChatBar] = useState(false);
  const [image, setImage] = useState(null);
  const [isTextInputOpen, setIsTextInputOpen] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [editingTextIndex, setEditingTextIndex] = useState(null); // Track which text element is being edited
  const [chat, setChat] = useState([])
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedElements, setSelectedElements] = useState([]);
  const [shouldSendCanvas, setShouldSendCanvas] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const isAdmin = user?.host;

  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const userBarRef = useRef(null);
  const imageInputRef = useRef(null);

  function handleClear() {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    setElements([]);
    setHistory([]);
    setSelectedElements([]);
    setTool("move");
  }

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) {
      toast.error('Canvas not found!');
      return;
    }

    try {
      // Create a temporary canvas with white background
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      
      tempCtx.fillStyle = '#FFFFFF';
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      
      tempCtx.drawImage(canvas, 0, 0);
      
      const dataURL = tempCanvas.toDataURL('image/png');
      
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      link.download = `whiteboard-${timestamp}.png`;
      link.href = dataURL;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Whiteboard downloaded successfully!');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download whiteboard');
    }
  }

  function handleUndo() {
    if (elements.length === 0) return;

    const lastElement = elements[elements.length - 1];

    setHistory((prevHistory) => {
      const newHistory = [...prevHistory, lastElement];
      // Limit history size to prevent memory issues
      if (newHistory.length > MAX_HISTORY) {
        return newHistory.slice(-MAX_HISTORY);
      }
      return newHistory;
    });

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
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');
      
      if (!isVideo && !isImage) {
        toast.error('Please select an image or video file');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const mediaData = reader.result;
        
        if (isVideo) {
          // Video: use fixed size
          const centerX = window.innerWidth / 2 - 100;
          const centerY = window.innerHeight / 2 - 100;
          
          setElements((prevElements) => [
            ...prevElements,
            {
              type: "video",
              offsetX: centerX,
              offsetY: centerY,
              height: 200,
              width: 200,
              src: mediaData,
            },
          ]);
          
          clearHistoryOnNewAction();
          setTool("move");
          toast.success('Video added to whiteboard!');
        } else {
          // Image: maintain aspect ratio
          const tempImg = document.createElement('img');
          tempImg.onload = () => {
            const naturalWidth = tempImg.naturalWidth;
            const naturalHeight = tempImg.naturalHeight;
            const aspectRatio = naturalWidth / naturalHeight;
            const maxSize = 300; // Maximum dimension
            let displayWidth, displayHeight;
            
            if (naturalWidth > naturalHeight) {
              // Landscape
              displayWidth = maxSize;
              displayHeight = maxSize / aspectRatio;
            } else {
              // Portrait or Square
              displayHeight = maxSize;
              displayWidth = maxSize * aspectRatio;
            }
            
            const centerX = window.innerWidth / 2 - displayWidth / 2;
            const centerY = window.innerHeight / 2 - displayHeight / 2;
            
            console.log('Adding image with dimensions:', { displayWidth, displayHeight, naturalWidth, naturalHeight });
            
            setElements((prevElements) => {
              const newElements = [
                ...prevElements,
                {
                  type: "image",
                  offsetX: centerX,
                  offsetY: centerY,
                  height: displayHeight,
                  width: displayWidth,
                  src: mediaData,
                },
              ];
              return newElements;
            });
            
            clearHistoryOnNewAction();
            setTool("move");
            toast.success('Image added to whiteboard!');
          };
          
          tempImg.onerror = (error) => {
            console.error('Failed to load image:', error);
            toast.error('Failed to load image. Please try again.');
          };
          
          tempImg.src = mediaData;
        }
      };
      reader.readAsDataURL(file);
    }
    // Reset file input
    event.target.value = null;
  }

  const clearHistoryOnNewAction = () => {
    if (history.length > 0) {
      setHistory([]);
    }
  };
  
  // Cleanup old elements when limit is reached
  useEffect(() => {
    if (elements.length > MAX_ELEMENTS) {
      console.warn('Element limit reached. Removing oldest elements to prevent memory issues.');
      setElements(prevElements => prevElements.slice(-MAX_ELEMENTS));
      setHistory([]);
    }
    
    // Check image count separately
    const imageCount = elements.filter(el => el.type === 'image').length;
    if (imageCount > MAX_IMAGE_ELEMENTS) {
      console.warn('Image limit reached. Removing oldest images.');
      setElements(prevElements => {
        const images = prevElements.filter(el => el.type === 'image');
        const nonImages = prevElements.filter(el => el.type !== 'image');
        const keptImages = images.slice(-MAX_IMAGE_ELEMENTS);
        return [...nonImages, ...keptImages];
      });
      toast.warning(`Image limit reached! Removed ${imageCount - MAX_IMAGE_ELEMENTS} oldest images.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements.length]);

  const sendCanvasData = () => {
    if (canvasRef.current && user?.presenter) {
      const canvas = canvasRef.current;
      // Use JPEG with 0.8 quality instead of PNG to reduce memory usage
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      socket.emit("WhiteboardImage", imageData);
    }
  };

  function handleTextSubmit() {
    if (!textInput.trim()) return; // Don't submit empty text

    if (editingTextIndex !== null) {
      // Update existing text element with new text, fontSize, fontFamily, and color
      setElements((prevElements) =>
        prevElements.map((el, idx) =>
          idx === editingTextIndex
            ? { ...el, text: textInput, fontSize, fontFamily, color }
            : el
        )
      );
      setEditingTextIndex(null);
    } else {
      // Create new text element
      setElements((prevElements) => [
        ...prevElements,
        {
          type: "text",
          offsetX: 50,
          offsetY: 50,
          text: textInput,
          color,
          fontSize,
          fontFamily,
        },
      ]);
    }
    clearHistoryOnNewAction();
    setTextInput("");
    setIsTextInputOpen(false);
    setTool("move");
  }

  function handleCancel() {
    setTextInput("");
    setIsTextInputOpen(false);
    setEditingTextIndex(null);
    setTool("move");
  }

  // Handler for double-click on text elements
  function handleTextDoubleClick(elementIndex, elementText) {
    setEditingTextIndex(elementIndex);
    setTextInput(elementText);
    setIsTextInputOpen(true);
    setTool("text");
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
      if (showHelp && !event.target.closest('.help-overlay')) {
        setShowHelp(false);
      }
    };

    if (showColorPicker || showHelp) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showColorPicker, showHelp]);

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

      {/* <div className="floating-buttons-container">
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
      </div> */}

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
            width: "350px",
            textAlign: "center",
          }}
        >
          <h3 style={{ marginBottom: "10px", fontSize: "16px" }}>
            {editingTextIndex !== null ? "Edit Text" : "Enter Text"}
          </h3>
          <div className="flex gap-4 items-center justify-center ">
          {/* Text Size Controls */}
          <div style={{ marginBottom: "15px", display: "flex", justifyContent: "center", alignItems: "center", gap: "10px" }}>
            <label style={{ fontSize: "12px", color: "#666", fontWeight: "500" }}>Font Size:</label>
            <div style={{ display: "flex", alignItems: "center", gap: "5px", border: "1px solid #ddd", borderRadius: "6px", padding: "4px 8px", backgroundColor: "#f9f9f9" }}>
              <button
                onClick={() => setFontSize(prev => Math.max(8, prev - 2))}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px",
                  display: "flex",
                  alignItems: "center",
                  borderRadius: "4px",
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = "#e0e0e0"}
                onMouseLeave={(e) => e.target.style.backgroundColor = "transparent"}
              >
                <Minus size={16} style={{ stroke: "#333" }} />
              </button>
              <span style={{ fontSize: "14px", fontWeight: "bold", minWidth: "35px", textAlign: "center", color: "#333" }}>
                {fontSize}px
              </span>
              <button
                onClick={() => setFontSize(prev => Math.min(72, prev + 2))}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px",
                  display: "flex",
                  alignItems: "center",
                  borderRadius: "4px",
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = "#e0e0e0"}
                onMouseLeave={(e) => e.target.style.backgroundColor = "transparent"}
              >
                <Plus size={16} style={{ stroke: "#333" }} />
              </button>
            </div>
          </div>
          
          <div style={{ marginBottom: "10px", fontSize: "12px", color: "#666" }}>
            Color: <span style={{ color: color }}>■</span>
          </div>
          </div>

          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleTextSubmit();
              } else if (e.key === "Escape") {
                handleCancel();
              }
            }}
            placeholder="Type your text here"
            autoFocus
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
          
          {/* Preview */}
          {textInput && (
            <div style={{ 
              marginBottom: "10px", 
              padding: "10px", 
              backgroundColor: "#f5f5f5", 
              borderRadius: "4px",
              minHeight: "40px"
            }}>
              <div style={{ fontSize: "11px", color: "#888", marginBottom: "5px" }}>Preview:</div>
              <div style={{ 
                fontSize: `${fontSize}px`, 
                fontFamily: fontFamily,
                color: color,
                wordBreak: "break-word"
              }}>
                {textInput}
              </div>
            </div>
          )}
          
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
        <div className="flex items-center justify-center gap-4 p-2 rounded-xl mb-4 toolNav absolute bottom-1" style={{ zIndex: 1000 }}>
          <div className="flex gap-4 [&>div]:cursor-pointer">
            <div
              data-tooltip-id="move-tool"
              data-tooltip-content="Move / Select"
              className={"text-white rounded-md p-3 transition-all duration-200 hover:scale-110 " + (tool === "move" ? "toolShadow" : "")}
              onClick={() => setTool("move")}
            >
              <Move size={20} style={{ stroke: tool === "move" ? "white" : "black" }} />
            </div>

            <div
              data-tooltip-id="pencil-tool"
              data-tooltip-content="Pencil"
              className={"text-white rounded-md p-3 transition-all duration-200 hover:scale-110 " + (tool === "pencil" ? "toolShadow" : "")}
              onClick={() => setTool("pencil")}
            >
              <Pencil size={20} style={{ stroke: tool === "pencil" ? "white" : "black" }} />
            </div>

            <div 
              data-tooltip-id="line-tool"
              data-tooltip-content="Line"
              className={"text-white rounded-md p-3 transition-all duration-200 hover:scale-110 " + (tool === "line" ? "toolShadow" : "")}
              onClick={() => setTool("line")}
            >
              <LineSquiggle size={20} style={{ stroke: tool === "line" ? "white" : "black" }} />
            </div>

            <div 
              data-tooltip-id="point-tool"
              data-tooltip-content="Point"
              className={"text-white rounded-md p-3 transition-all duration-200 hover:scale-110 " + (tool === "point" ? "toolShadow" : "")}
              onClick={() => setTool("point")}
            >
              <CircleSmall size={20} style={{ fill: tool === "point" ? "white" : "black", stroke: tool === "point" ? "white" : "black" }} />
            </div>

            <div 
              data-tooltip-id="text-tool"
              data-tooltip-content="Text"
              className={"text-white rounded-md p-3 transition-all duration-200 hover:scale-110 " + (tool === "text" ? "toolShadow" : "")}
              onClick={() => { setTool("text"); setIsTextInputOpen(true) }}
            >
              <CaseUpper size={20} style={{ stroke: tool === "text" ? "white" : "black" }} />
            </div>

            <div 
              data-tooltip-id="rect-tool"
              data-tooltip-content="Rectangle"
              className={"text-white rounded-md p-3 transition-all duration-200 hover:scale-110 " + (tool === "rect" ? "toolShadow" : "")}
              onClick={() => setTool("rect")}
            >
              <RectangleHorizontal size={20} style={{ stroke: tool === "rect" ? "white" : "black" }} />
            </div>

            <div 
              data-tooltip-id="circle-tool"
              data-tooltip-content="Circle"
              className={"text-white rounded-md p-3 transition-all duration-200 hover:scale-110 " + (tool === "circle" ? "toolShadow" : "")}
              onClick={() => setTool("circle")}
            >
              <Circle size={20} style={{ stroke: tool === "circle" ? "white" : "black" }} />
            </div>

            <div 
              data-tooltip-id="eraser-tool"
              data-tooltip-content="Eraser"
              className={"text-white rounded-md p-3 transition-all duration-200 hover:scale-110 " + (tool === "eraser" ? "toolShadow" : "")}
              onClick={() => setTool("eraser")}
            >
              <Eraser size={20} style={{ stroke: tool === "eraser" ? "white" : "black" }} />
            </div>
          </div>

          <div
            className={"relative color-picker-container rounded-md p-3 transition-all duration-200 hover:scale-110 " + (tool === "color" ? "toolShadow" : "")}
            data-tooltip-id="color-picker"
            data-tooltip-content="Color Picker"
          >
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

          <div
            className={"image-selector-container relative rounded-md p-2 transition-all duration-200 hover:scale-110 cursor-pointer"}
            data-tooltip-id="image-tool"
            data-tooltip-content="Insert Image/Video"
            onClick={() => imageInputRef.current?.click()}
          >
            <Image size={20} style={{ stroke: "black" }} />
          </div>
          
          {/* Hidden file input for image/video upload */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={(e) => {
              handleImageSelect(e);
            }}
            style={{ display: 'none' }}
          />

          <div className="flex items-center gap-2">
            <button
              className={"undo rounded-md p-2 cursor-pointer transition-all duration-200 hover:scale-110 " + (tool === "undo" ? "toolShadow" : "")}
              onClick={handleUndo}
              disabled={elements.length === 0}
              data-tooltip-id="undo-tool"
              data-tooltip-content="Undo (Ctrl+Z)"
            >
              <Undo size={20} />
            </button>
            <button
              className={"redo rounded-md p-2 cursor-pointer transition-all duration-200 hover:scale-110 " + (tool === "redo" ? "toolShadow" : "")}
              onClick={handleRedo}
              disabled={history.length === 0}
              data-tooltip-id="redo-tool"
              data-tooltip-content="Redo (Ctrl+Y)"
            >
              <Redo size={20} />
            </button>
            <button
              className="download rounded-md p-2 cursor-pointer transition-all duration-200 hover:scale-110 bg-green-500 hover:bg-green-600"
              onClick={handleDownload}
              data-tooltip-id="download-tool"
              data-tooltip-content="Download as PNG"
            >
              <Download size={20} style={{ stroke: "white" }} />
            </button>
          </div>

          <div>
            <button
              className="bg-red-500 rounded-md p-2 clear transition-all duration-200 hover:scale-105 hover:bg-red-600"
              onClick={handleClear}
              data-tooltip-id="clear-tool"
              data-tooltip-content="Clear Canvas"
            >
              Clear Canvas
            </button>
          </div>

          {/* Tooltip Components */}
          <Tooltip id="move-tool" place="top" delayShow={300} events={['hover']} />
          <Tooltip id="pencil-tool" place="top" delayShow={300} events={['hover']} />
          <Tooltip id="line-tool" place="top" delayShow={300} events={['hover']} />
          <Tooltip id="point-tool" place="top" delayShow={300} events={['hover']} />
          <Tooltip id="text-tool" place="top" delayShow={300} events={['hover']} />
          <Tooltip id="rect-tool" place="top" delayShow={300} events={['hover']} />
          <Tooltip id="circle-tool" place="top" delayShow={300} events={['hover']} />
          <Tooltip id="eraser-tool" place="top" delayShow={300} events={['hover']} />
          <Tooltip id="color-picker" place="top" delayShow={300} events={['hover']} />
          <Tooltip id="image-tool" place="top" delayShow={300} events={['hover']} />
          <Tooltip id="undo-tool" place="top" delayShow={300} events={['hover']} />
          <Tooltip id="redo-tool" place="top" delayShow={300} events={['hover']} />
          <Tooltip id="download-tool" place="top" delayShow={300} events={['hover']} />
          <Tooltip id="clear-tool" place="top" delayShow={300} events={['hover']} />
        </div>
      )}
      {isHost && user?.presenter &&
        <>
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
            onTextDoubleClick={handleTextDoubleClick}
          />
          
          {/* Memory usage indicator - Enhanced with image count */}
          {(elements.length > MAX_ELEMENTS * 0.8 || elements.filter(el => el.type === 'image').length > MAX_IMAGE_ELEMENTS * 0.7) && (
            <div style={{
              position: 'fixed',
              top: '20px',
              right: '20px',
              backgroundColor: elements.length > MAX_ELEMENTS * 0.9 || elements.filter(el => el.type === 'image').length > MAX_IMAGE_ELEMENTS * 0.9 ? '#ff4444' : '#ffaa00',
              color: 'white',
              padding: '12px 16px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 'bold',
              zIndex: 1000,
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              minWidth: '200px'
            }}>
              <div style={{ marginBottom: '4px' }}>
                ⚠️ Elements: {elements.length}/{MAX_ELEMENTS}
              </div>
              <div style={{ fontSize: '11px', opacity: 0.9 }}>
                📷 Images: {elements.filter(el => el.type === 'image').length}/{MAX_IMAGE_ELEMENTS}
              </div>
            </div>
          )}
        </>
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
