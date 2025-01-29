import React, { useLayoutEffect, useEffect, useState, useRef } from "react";
import rough from "roughjs/bundled/rough.esm";
import { RoughGenerator } from "roughjs/bin/generator";

const roughGenerator = rough.generator();

const Whiteboard = ({
  image,
  canvasRef,
  ctxRef,
  elements,
  setElements,
  tool,
  color,
  setColor,
  user,
  socket,
  setIsTextInputOpen,
  isTextInputOpen,
}) => {
  console.log("isTextInputOpen ==> ", isTextInputOpen);
  const [img, setImg] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [dragging, setDragging] = useState(false);
  const [draggedElementIndex, setDraggedElementIndex] = useState(null);
  const imagesCache = useRef({});
  useEffect(() => {
    socket.on("WhiteboardImageRes", (data) => {
      console.log("image data received", data.imgURL);
      setImg(data.imgURL);
    });
  }, [socket]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = 2 * window.innerWidth;
      canvas.height = 2 * window.innerHeight;

      const ctx = canvas.getContext("2d");
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";

      ctxRef.current = ctx;
    }
  }, []);

  useEffect(() => {
    if (canvasRef.current) ctxRef.current.strokeStyle = color;
  }, [color]);

  useLayoutEffect(() => {
    if (!canvasRef.current || elements.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    const roughCanvas = rough.canvas(canvas);

    // Clear canvas before drawing
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let imagesToLoad = 0;
    let imagesLoaded = 0;

    const sendCanvasData = () => {
      if (imagesLoaded === imagesToLoad) {
        const canvasImage = canvas.toDataURL();
        socket.emit("WhiteboardImage", canvasImage);
      }
    };

    elements.forEach((element) => {
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
      } else if (element.type === "cricle") {
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
            imagesLoaded++;
            sendCanvasData();
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
    });

    // Send canvas data immediately if there are no images
    if (imagesToLoad === 0) sendCanvasData();
  }, [elements, socket]);
  console.log("elements", elements);

  function handleMouseDown(e) {
    const { offsetX, offsetY } = e.nativeEvent;
    const clickedElementIndex = elements.findIndex(
        (element) =>
          offsetX >= element.offsetX &&
          offsetX <= element.offsetX + element.width &&
          offsetY >= element.offsetY &&
          offsetY <= element.offsetY + element.height
      );
      
      if (clickedElementIndex !== -1) {
        setDragging(true);
        setDraggedElementIndex(clickedElementIndex);
        return;
      }
      const clickedElementIndexText = elements.findIndex((element) => {
     if (element.type === "text") {
          const textWidth = ctxRef.current.measureText(element.text).width;
          return (
            element.type === "text"&&
            offsetX >= element.offsetX &&
            offsetX <= element.offsetX + textWidth &&
            offsetY >= element.offsetY - 20 && 
            offsetY <= element.offsetY
          );
        } 
        // Add checks for other types like line, circle, etc.
        return false;
      });
      if (clickedElementIndexText !== -1) {
        setDragging(true);
        setDraggedElementIndex(clickedElementIndexText);
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
    } else if (tool === "cricle") {
      setElements((prevElements) => [
        ...prevElements,
        {
          type: "cricle",
          offsetX,
          offsetY,
          height: 0,
          width: 0,
          color,
        },
      ]);
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
      setTextInput("");
     
    }
    setIsDrawing(true);
  }

  console.log("tool ==> ::::::::::::::::::::::::: ", tool);

  function handleMouseUp(e) {
    setIsDrawing(false);
    setDragging(false);
    setDraggedElementIndex(null);
  }

  function handleMouseMove(e) {
    const { offsetX, offsetY } = e.nativeEvent;
    if (dragging && draggedElementIndex !== null) {
        setElements((prevElements) =>
          prevElements.map((ele, index) =>
            index === draggedElementIndex
              ? { ...ele, offsetX, offsetY }
              : ele
          )
        );
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
      } else if (tool === "cricle") {
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
          style={{
            height: window.innerHeight * 2,
            width: window.innerWidth * 2,
            maxWidth: "none",
            border: "5px solid green",
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{ height: "100vh", width: "100vw", overflow: "hidden" }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      className="shadow-lg"
    >
      <canvas className="bg-white" ref={canvasRef}></canvas>
    </div>
  );
};

export default Whiteboard;
