import { useLayoutEffect, useEffect, useState, useRef } from "react";
import rough from "roughjs/bundled/rough.esm";

const roughGenerator = rough.generator();

const Whiteboard = ({
  image,
  canvasRef,
  ctxRef,
  elements,
  setElements,
  clearHistoryOnNewAction,
  shouldSendCanvas,
  setShouldSendCanvas,
  tool,
  color,
  user,
  socket,
  sendCanvasData,
  selectedElements,
  setSelectedElements
}) => {

  const [img, setImg] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [dragging, setDragging] = useState(false);
  const [draggedElementIndex, setDraggedElementIndex] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizing, setResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState(null);
  const [resizeElementIndex, setResizeElementIndex] = useState(null);
  const [cursor, setCursor] = useState('default');
  const [erasing, setErasing] = useState(false);
  const imagesCache = useRef({});
  const userCanvasRef = useRef(null);



  useEffect(() => {
    socket.on("WhiteboardImageRes", (data) => {
      setImg(data.imgURL);
    });
  }, [socket]);


  useEffect(() => {
    const canvas = canvasRef.current;
    const userCanvas = userCanvasRef.current;
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const ctx = canvas.getContext("2d");
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";

      ctxRef.current = ctx;
    }

    if (userCanvas) {
      userCanvas.width = window.innerWidth;
      userCanvas.height = window.innerHeight;

      const userCtx = userCanvas.getContext("2d");
      userCtx.strokeStyle = color;
      userCtx.lineWidth = 2;
      userCtx.lineCap = "round";
    }
  }, []);

  useEffect(() => {
    if (canvasRef.current) ctxRef.current.strokeStyle = color;
  }, [color]);

  useLayoutEffect(() => {
    if (!canvasRef.current || !ctxRef.current) return;

    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    const roughCanvas = rough.canvas(canvas);

    // Clear canvas before drawing
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let imagesToLoad = 0;

    elements.forEach((element, index) => {
      // Check if this element is selected
      const isSelected = selectedElements && selectedElements.some(selectedEl =>
        selectedEl.offsetX === element.offsetX &&
        selectedEl.offsetY === element.offsetY &&
        selectedEl.type === element.type
      );

      if (element.type === "line") {
        roughCanvas.draw(
          roughGenerator.line(
            element.offsetX,
            element.offsetY,
            element.width,
            element.height,
            {
              stroke: element.color,
              strokeWidth: 3,
              roughness: 0,
            }
          )
        );
      } else if (element.type === "pencil") {
        roughCanvas.linearPath(element.path, {
          stroke: element.color,
          strokeWidth: 3,
          roughness: 0,
        });
      } else if (element.type === "rect") {
        // Only draw if rectangle has some size
        if (Math.abs(element.width) > 1 && Math.abs(element.height) > 1) {
          roughCanvas.draw(
            roughGenerator.rectangle(
              element.offsetX,
              element.offsetY,
              element.width,
              element.height,
              {
                stroke: element.color,
                strokeWidth: 3,
                roughness: 0,
              }
            )
          );
        }
      } else if (element.type === "circle") {
        ctx.beginPath();
        ctx.arc(
          element.offsetX + element.width / 2,
          element.offsetY + element.height / 2,
          Math.abs(element.width / 2),
          0,
          2 * Math.PI
        );
        ctx.strokeStyle = element.color;
        ctx.lineWidth = 3;
        ctx.stroke();
      } else if (element.type === "point") {
        ctx.beginPath();
        ctx.arc(element.offsetX, element.offsetY, 5, 0, 2 * Math.PI);
        ctx.fillStyle = element.color;
        ctx.fill();
      } else if (element.type === "image") {
        if (!imagesCache.current[element.src]) {
          imagesToLoad++;
          const imageObj = new Image();
          imageObj.src = element.src;
          imageObj.onload = () => {
            imagesCache.current[element.src] = imageObj;
            ctx.drawImage(
              imageObj,
              element.offsetX,
              element.offsetY,
              element.width,
              element.height
            );
          };
        } else {
          ctx.drawImage(
            imagesCache.current[element.src],
            element.offsetX,
            element.offsetY,
            element.width,
            element.height
          );
        }
      } else if (element.type === "text") {
        ctx.fillStyle = element.color;
        ctx.font = "20px Arial";
        ctx.fillText(element.text, element.offsetX, element.offsetY);
      }

      // Draw selection indicator for selected elements
      if (isSelected) {
        ctx.save();
        ctx.strokeStyle = '#007acc';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);

        if (element.type === 'circle') {
          const centerX = element.offsetX + element.width / 2;
          const centerY = element.offsetY + element.height / 2;
          const radius = Math.abs(element.width / 2);
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius + 5, 0, 2 * Math.PI);
          ctx.stroke();
        } else if (element.type === 'line') {
          ctx.beginPath();
          ctx.moveTo(element.offsetX - 5, element.offsetY - 5);
          ctx.lineTo(element.width + 5, element.height + 5);
          ctx.stroke();
        } else if (element.type !== 'pencil' && element.type !== 'point') {
          // Handle negative width/height for selection rectangle
          const minX = Math.min(element.offsetX, element.offsetX + element.width);
          const minY = Math.min(element.offsetY, element.offsetY + element.height);
          const rectWidth = Math.abs(element.width);
          const rectHeight = Math.abs(element.height);

          ctx.strokeRect(
            minX - 5,
            minY - 5,
            rectWidth + 10,
            rectHeight + 10
          );
        }

        ctx.restore();
      }
    });

    if (shouldSendCanvas && user?.presenter) {
      setTimeout(() => {
        sendCanvasData();
        setShouldSendCanvas(false);
      }, 0);
    }

    socket.emit("WhiteboardElements", elements);

  }, [elements, shouldSendCanvas]);

  const getResizeDirection = (x, y, element) => {
    if (element.type === 'text' || element.type === 'pencil' || element.type === 'point') {
      return null;
    }

    if (element.type === 'circle') {
      return getCircleResizeDirection(x, y, element);
    }

    if (element.type === 'line') {
      return getLineResizeDirection(x, y, element);
    }

    const handleSize = 8;
    const { offsetX, offsetY, width, height } = element;

    // Normalize bounds to handle negative width/height
    const left = Math.min(offsetX, offsetX + width);
    const right = Math.max(offsetX, offsetX + width);
    const top = Math.min(offsetY, offsetY + height);
    const bottom = Math.max(offsetY, offsetY + height);

    // Corner handles
    if (Math.abs(x - right) <= handleSize && Math.abs(y - bottom) <= handleSize) return 'se';
    if (Math.abs(x - left) <= handleSize && Math.abs(y - bottom) <= handleSize) return 'sw';
    if (Math.abs(x - right) <= handleSize && Math.abs(y - top) <= handleSize) return 'ne';
    if (Math.abs(x - left) <= handleSize && Math.abs(y - top) <= handleSize) return 'nw';

    // Edge handles
    if (Math.abs(x - right) <= handleSize && y >= top && y <= bottom) return 'e';
    if (Math.abs(x - left) <= handleSize && y >= top && y <= bottom) return 'w';
    if (Math.abs(y - bottom) <= handleSize && x >= left && x <= right) return 's';
    if (Math.abs(y - top) <= handleSize && x >= left && x <= right) return 'n';

    return null;
  };


  const getResizeCursor = (direction) => {
    switch (direction) {
      case 'n':
      case 's':
        return 'ns-resize';
      case 'e':
      case 'w':
        return 'ew-resize';
      case 'ne':
      case 'sw':
        return 'nesw-resize';
      case 'nw':
      case 'se':
        return 'nwse-resize';
      case 'radial':
        return 'nwse-resize';
      case 'start':
      case 'end':
        return 'crosshair';
      default:
        return 'default';
    }
  };

  const isPointInCircle = (x, y, element) => {
    const centerX = element.offsetX + element.width / 2;
    const centerY = element.offsetY + element.height / 2;
    const radius = Math.abs(element.width / 2);
    const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
    return distance <= radius;
  };

  const getCircleResizeDirection = (x, y, element) => {
    const handleSize = 8;
    const centerX = element.offsetX + element.width / 2;
    const centerY = element.offsetY + element.height / 2;
    const radius = Math.abs(element.width / 2);

    const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
    if (Math.abs(distance - radius) <= handleSize) {
      return 'radial';
    }

    return null;
  };

  const isPointNearLine = (x, y, element, threshold = 5) => {
    const x1 = element.offsetX;
    const y1 = element.offsetY;
    const x2 = element.width;
    const y2 = element.height;

    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;

    if (lenSq === 0) return Math.sqrt(A * A + B * B) <= threshold; // Point line

    let param = dot / lenSq;

    let xx, yy;
    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = x - xx;
    const dy = y - yy;
    return Math.sqrt(dx * dx + dy * dy) <= threshold;
  };

  const getLineResizeDirection = (x, y, element) => {
    const handleSize = 8;
    const x1 = element.offsetX;
    const y1 = element.offsetY;
    const x2 = element.width;
    const y2 = element.height;

    if (Math.sqrt((x - x1) ** 2 + (y - y1) ** 2) <= handleSize) {
      return 'start';
    }

    if (Math.sqrt((x - x2) ** 2 + (y - y2) ** 2) <= handleSize) {
      return 'end';
    }

    return null;
  };
  const isPointInElement = (x, y, element) => {
    if (element.type === 'circle') {
      return isPointInCircle(x, y, element);
    } else if (element.type === 'line') {
      return isPointNearLine(x, y, element);
    } else if (element.type === 'pencil') {
      if (!element.path || element.path.length === 0) return false;

      const threshold = 8;
      for (let i = 0; i < element.path.length - 1; i++) {
        const [x1, y1] = element.path[i];
        const [x2, y2] = element.path[i + 1] || element.path[i];

        const A = x - x1;
        const B = y - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;

        if (lenSq === 0) {
          if (Math.sqrt(A * A + B * B) <= threshold) return true;
        } else {
          let param = dot / lenSq;
          if (param < 0) param = 0;
          if (param > 1) param = 1;

          const xx = x1 + param * C;
          const yy = y1 + param * D;
          const dx = x - xx;
          const dy = y - yy;

          if (Math.sqrt(dx * dx + dy * dy) <= threshold) return true;
        }
      }
      return false;
    } else if (element.type === 'point') {
      const distance = Math.sqrt((x - element.offsetX) ** 2 + (y - element.offsetY) ** 2);
      return distance <= 8;
    } else if (element.type === 'text') {
      const textWidth = ctxRef.current?.measureText(element.text).width || 100;
      return (
        x >= element.offsetX &&
        x <= element.offsetX + textWidth &&
        y >= element.offsetY - 20 &&
        y <= element.offsetY
      );
    } else {
      // Rectangle-based collision for rect, image
      // Handle negative width/height by normalizing the bounds
      const minX = Math.min(element.offsetX, element.offsetX + element.width);
      const maxX = Math.max(element.offsetX, element.offsetX + element.width);
      const minY = Math.min(element.offsetY, element.offsetY + element.height);
      const maxY = Math.max(element.offsetY, element.offsetY + element.height);

      return (
        x >= minX &&
        x <= maxX &&
        y >= minY &&
        y <= maxY
      );
    }
  };

  function handleMouseDown(e) {
    const { offsetX, offsetY } = e.nativeEvent;

    for (let i = elements.length - 1; i >= 0; i--) {
      const element = elements[i];
      const direction = getResizeDirection(offsetX, offsetY, element);
      if (direction) {
        setResizing(true);
        setResizeDirection(direction);
        setResizeElementIndex(i);
        return;
      }
    }

    let clickedElementIndex = -1;
    for (let i = elements.length - 1; i >= 0; i--) {
      if (isPointInElement(offsetX, offsetY, elements[i])) {
        clickedElementIndex = i;
        break;
      }
    }

    if (clickedElementIndex !== -1) {
      const clickedElement = elements[clickedElementIndex];

      if (e.ctrlKey && setSelectedElements) {
        const isAlreadySelected = selectedElements.some(selectedEl =>
          selectedEl.offsetX === clickedElement.offsetX &&
          selectedEl.offsetY === clickedElement.offsetY &&
          selectedEl.type === clickedElement.type
        );

        if (isAlreadySelected) {
          setSelectedElements(selectedElements.filter(selectedEl =>
            !(selectedEl.offsetX === clickedElement.offsetX &&
              selectedEl.offsetY === clickedElement.offsetY &&
              selectedEl.type === clickedElement.type)
          ));
        } else {
          setSelectedElements([...selectedElements, clickedElement]);
        }
        return;
      } else if (setSelectedElements) {
        setSelectedElements([clickedElement]);
      }

      const dragOffsetX = offsetX - clickedElement.offsetX;
      const dragOffsetY = offsetY - clickedElement.offsetY;

      setDragging(true);
      setDraggedElementIndex(clickedElementIndex);
      setDragOffset({ x: dragOffsetX, y: dragOffsetY });
      return;
    }

    if (setSelectedElements && !e.ctrlKey) {
      setSelectedElements([]);
    }

    if (tool === "pencil") {
      setElements((prevElements) => [
        ...prevElements,
        {
          type: "pencil",
          offsetX,
          offsetY,
          path: [[offsetX, offsetY]],
          color,
        },
      ]);
      clearHistoryOnNewAction();
    } else if (tool === "line") {
      setElements((prevElements) => [
        ...prevElements,
        {
          type: "line",
          offsetX,
          offsetY,
          height: offsetY,
          width: offsetX,
          color,
        },
      ]);
      clearHistoryOnNewAction();
    } else if (tool === "rect") {
      setElements((prevElements) => [
        ...prevElements,
        {
          type: "rect",
          offsetX,
          offsetY,
          height: 0,
          width: 0,
          color,
        },
      ]);
      clearHistoryOnNewAction();
    } else if (tool === "circle") {
      setElements((prevElements) => [
        ...prevElements,
        {
          type: "circle",
          offsetX,
          offsetY,
          height: 0,
          width: 0,
          color,
        },
      ]);
      clearHistoryOnNewAction();
    } else if (tool === "image") {
      setElements((prevElements) => [
        ...prevElements,
        {
          type: "image",
          offsetX,
          offsetY,
          height: 50,
          width: 50,
          src: image,
        },
      ]);
      clearHistoryOnNewAction();
    } else if (tool === "point") {
      setElements((prevElements) => [
        ...prevElements,
        {
          type: "point",
          offsetX,
          offsetY,
          color,
        },
      ]);
      clearHistoryOnNewAction();
    } else if (tool === "text") {
      setElements((prevElements) => [
        ...prevElements,
        {
          type: "text",
          offsetX,
          offsetY,
          text: textInput,
          color,
        },
      ]);
      clearHistoryOnNewAction();
      setTextInput("");
    } else if (tool === "eraser") {
      let elementToErase = -1;
      for (let i = elements.length - 1; i >= 0; i--) {
        if (isPointInElement(offsetX, offsetY, elements[i])) {
          elementToErase = i;
          break;
        }
      }

      if (elementToErase !== -1) {
        setElements((prevElements) =>
          prevElements.filter((_, index) => index !== elementToErase)
        );
        clearHistoryOnNewAction();
      }
      setErasing(true);
    }
    if (tool !== "eraser") {
      setIsDrawing(true);
    }
  }

  function handleMouseUp(e) {
    setIsDrawing(false);
    setDragging(false);
    setDraggedElementIndex(null);
    setDragOffset({ x: 0, y: 0 });
    setResizing(false);
    setResizeDirection(null);
    setResizeElementIndex(null);
    setErasing(false);
    sendCanvasData();
  }

  function handleMouseMove(e) {
    const { offsetX, offsetY } = e.nativeEvent;

    if (!isDrawing && !dragging && !resizing && !erasing) {
      let newCursor = 'default';

      if (tool === "eraser") {
        newCursor = 'crosshair';
      } else {
        for (let i = elements.length - 1; i >= 0; i--) {
          const element = elements[i];
          const direction = getResizeDirection(offsetX, offsetY, element);
          if (direction) {
            newCursor = getResizeCursor(direction);
            break;
          } else if (isPointInElement(offsetX, offsetY, element)) {
            newCursor = 'move';
            break;
          }
        }
      }

      if (cursor !== newCursor) {
        setCursor(newCursor);
      }
    }

    if (resizing && resizeElementIndex !== null) {
      setElements((prevElements) =>
        prevElements.map((ele, index) => {
          if (index === resizeElementIndex) {
            const newElement = { ...ele };
            const originalX = ele.offsetX;
            const originalY = ele.offsetY;
            const originalWidth = ele.width;
            const originalHeight = ele.height;

            if (ele.type === 'circle' && resizeDirection === 'radial') {
              const centerX = originalX + originalWidth / 2;
              const centerY = originalY + originalHeight / 2;
              const newRadius = Math.sqrt((offsetX - centerX) ** 2 + (offsetY - centerY) ** 2);
              const minRadius = 5;
              const finalRadius = Math.max(newRadius, minRadius);

              newElement.width = finalRadius * 2;
              newElement.height = finalRadius * 2;
              newElement.offsetX = centerX - finalRadius;
              newElement.offsetY = centerY - finalRadius;
            } else if (ele.type === 'line') {
              switch (resizeDirection) {
                case 'start':
                  newElement.offsetX = offsetX;
                  newElement.offsetY = offsetY;
                  break;
                case 'end':
                  newElement.width = offsetX;
                  newElement.height = offsetY;
                  break;
              }
            } else {
              switch (resizeDirection) {
                case 'se':
                  newElement.width = offsetX - originalX;
                  newElement.height = offsetY - originalY;
                  break;
                case 'sw':
                  newElement.offsetX = offsetX;
                  newElement.width = originalX + originalWidth - offsetX;
                  newElement.height = offsetY - originalY;
                  break;
                case 'ne':
                  newElement.offsetY = offsetY;
                  newElement.width = offsetX - originalX;
                  newElement.height = originalY + originalHeight - offsetY;
                  break;
                case 'nw':
                  newElement.offsetX = offsetX;
                  newElement.offsetY = offsetY;
                  newElement.width = originalX + originalWidth - offsetX;
                  newElement.height = originalY + originalHeight - offsetY;
                  break;
                case 'e':
                  newElement.width = offsetX - originalX;
                  break;
                case 'w':
                  newElement.offsetX = offsetX;
                  newElement.width = originalX + originalWidth - offsetX;
                  break;
                case 's':
                  newElement.height = offsetY - originalY;
                  break;
                case 'n':
                  newElement.offsetY = offsetY;
                  newElement.height = originalY + originalHeight - offsetY;
                  break;
              }

              if (newElement.width < 10) newElement.width = 10;
              if (newElement.height < 10) newElement.height = 10;
            }

            return newElement;
          }
          return ele;
        })
      );
    } else if (dragging && draggedElementIndex !== null) {
      setElements((prevElements) =>
        prevElements.map((ele, index) =>
          index === draggedElementIndex
            ? {
              ...ele,
              offsetX: offsetX - dragOffset.x,
              offsetY: offsetY - dragOffset.y
            }
            : ele
        )
      );
    }

    if (erasing && tool === "eraser") {
      let elementToErase = -1;
      for (let i = elements.length - 1; i >= 0; i--) {
        if (isPointInElement(offsetX, offsetY, elements[i])) {
          elementToErase = i;
          break;
        }
      }

      if (elementToErase !== -1) {
        setElements((prevElements) =>
          prevElements.filter((_, index) => index !== elementToErase)
        );
      }
    }

    if (isDrawing) {
      if (tool === "pencil") {
        const { path } = elements[elements.length - 1];
        const newPath = [...path, [offsetX, offsetY]];

        setElements((prevElements) =>
          prevElements.map((ele, index) => {
            if (index === elements.length - 1) {
              return {
                ...ele,
                path: newPath,
              };
            } else {
              return ele;
            }
          })
        );
      } else if (tool === "line") {
        setElements((prevElements) =>
          prevElements.map((ele, index) => {
            if (index === elements.length - 1) {
              return {
                ...ele,
                height: offsetY,
                width: offsetX,
              };
            } else {
              return ele;
            }
          })
        );
      } else if (tool === "rect") {
        setElements((prevElements) =>
          prevElements.map((ele, index) => {
            if (index === elements.length - 1) {
              return {
                ...ele,
                height: offsetY - ele.offsetY,
                width: offsetX - ele.offsetX,
              };
            } else {
              return ele;
            }
          })
        );
      } else if (tool === "circle") {
        setElements((prevElements) =>
          prevElements.map((ele, index) => {
            if (index === elements.length - 1) {
              return {
                ...ele,
                height: offsetY - ele.offsetY,
                width: offsetX - ele.offsetX,
              };
            } else {
              return ele;
            }
          })
        );
      } else if (tool === "image") {
        setElements((prevElements) =>
          prevElements.map((ele, index) => {
            if (index === elements.length - 1) {
              return {
                ...ele,
                height: offsetY - ele.offsetY,
                width: offsetX - ele.offsetX,
              };
            } else {
              return ele;
            }
          })
        );
      }
    }
  }

  if (!user?.presenter && img) {
    return (
      <div
        style={{
          border: "2px solid black",
          height: "100vh",
          width: "100vw",
          overflow: "hidden",
          backgroundColor: "white",
        }}
      >
        <img
          src={img}
          alt="real time white board image shared by presenter"
          style={{ width: "100vw", height: "100vh", objectFit: "contain" }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        cursor: cursor
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      className={`shadow-lg ${!user?.presenter ? "pointer-events-none" : ""}`}
    >
      <canvas className="bg-white" ref={canvasRef}></canvas>
    </div>
  );
};

export default Whiteboard;
