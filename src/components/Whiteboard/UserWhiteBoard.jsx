import { useEffect, useLayoutEffect, useRef, useState } from "react";
import rough from "roughjs/bundled/rough.esm";

const roughGenerator = rough.generator();

function UserWhiteBoard({ socket, user, ctxRef, elements, setElements, color, setColor, boardDimensions }) {

  const imagesCache = useRef({});
  const canvasRef = useRef(null);
  const [viewportSize, setViewportSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const boardWidth = Math.max(320, Math.floor(boardDimensions?.width || viewportSize.width));
  const boardHeight = Math.max(180, Math.floor(boardDimensions?.height || viewportSize.height));
  const stageScale = Math.min(viewportSize.width / boardWidth, viewportSize.height / boardHeight);
  const safeStageScale = Number.isFinite(stageScale) && stageScale > 0 ? stageScale : 1;
  const stageWidth = boardWidth * safeStageScale;
  const stageHeight = boardHeight * safeStageScale;
  const stageOffsetX = (viewportSize.width - stageWidth) / 2;
  const stageOffsetY = (viewportSize.height - stageHeight) / 2;
  const stageBorderRadius = 12;
  const outerAreaColor = "#d9dee6";
  const boardAreaColor = "#ffffff";

  useEffect(() => {
    const handleResize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Canvas setup
  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    canvas.width = boardWidth;
    canvas.height = boardHeight;

    const ctx = canvas.getContext("2d");
    ctx.lineWidth = 2;
    ctx.lineCap = "round";

    ctxRef.current = ctx;
  }, [boardHeight, boardWidth, ctxRef]);

  useEffect(() => {
    if (ctxRef.current) {
      ctxRef.current.strokeStyle = color;
    }
  }, [color, ctxRef]);

  // Socket listeners
  useEffect(() => {

    const handleColorChange = (data) => {
      const { color } = data;
      setColor(color);

      if (ctxRef.current) {
        ctxRef.current.strokeStyle = color;
      }
    };

    const handleElements = (data) => {
      setElements(data.elements);
    };

    socket.on("colorChange", handleColorChange);
    socket.on("WhiteboardElements", handleElements);

    return () => {
      socket.off("colorChange", handleColorChange);
      socket.off("WhiteboardElements", handleElements);
    };

  }, [socket, setElements, setColor]);

  // Draw elements
  useLayoutEffect(() => {

    const canvas = canvasRef.current;
    const ctx = ctxRef.current;

    if (!canvas || !ctx) return;

    const roughCanvas = rough.canvas(canvas);

    ctx.clearRect(0, 0, boardWidth, boardHeight);

    elements.forEach((element) => {

      switch (element.type) {

        case "line":
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
          break;

        case "pencil":
          roughCanvas.linearPath(element.path, {
            stroke: element.color,
            strokeWidth: 3,
            roughness: 0,
          });
          break;

        case "rect":
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
          break;

        case "circle":
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
          break;

        case "point":
          ctx.beginPath();
          ctx.arc(element.offsetX, element.offsetY, 5, 0, 2 * Math.PI);
          ctx.fillStyle = element.color;
          ctx.fill();
          break;

        case "image":

          const drawX = Math.min(element.offsetX, element.offsetX + element.width);
          const drawY = Math.min(element.offsetY, element.offsetY + element.height);
          const drawWidth = Math.abs(element.width);
          const drawHeight = Math.abs(element.height);

          if (!imagesCache.current[element.src]) {

            const img = new Image();
            img.src = element.src;

            img.onload = () => {
              imagesCache.current[element.src] = img;

              ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
            };

          } else {

            ctx.drawImage(
              imagesCache.current[element.src],
              drawX,
              drawY,
              drawWidth,
              drawHeight
            );

          }

          break;

        case "text":
          ctx.fillStyle = element.color;
          ctx.font = `${element.fontSize || 20}px ${element.fontFamily || "Arial"}`;
          ctx.fillText(element.text, element.offsetX, element.offsetY);
          break;

        default:
          break;
      }

    });

  }, [boardHeight, boardWidth, elements, ctxRef]);

  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        position: "relative",
        backgroundColor: outerAreaColor
      }}
      className={`shadow-lg ${!user?.presenter ? "pointer-events-none" : ""}`}
    >

      <div
        style={{
          position: "absolute",
          top: `${stageOffsetY}px`,
          left: `${stageOffsetX}px`,
          width: `${boardWidth}px`,
          height: `${boardHeight}px`,
          transform: `scale(${safeStageScale})`,
          transformOrigin: "top left",
          border: "2px solid #8d99ab",
          borderRadius: `${stageBorderRadius}px`,
          boxShadow: "0 14px 28px rgba(15, 23, 42, 0.18)",
          overflow: "hidden",
          backgroundColor: boardAreaColor,
        }}
      >
        <canvas
          ref={canvasRef}
          width={boardWidth}
          height={boardHeight}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: `${boardWidth}px`,
            height: `${boardHeight}px`,
            zIndex: 2,
            backgroundColor: "transparent"
          }}
        />

        {elements
          .filter(el => el.type === "video")
          .map((element, index) => {

            const displayX = Math.min(element.offsetX, element.offsetX + element.width);
            const displayY = Math.min(element.offsetY, element.offsetY + element.height);
            const displayWidth = Math.abs(element.width);
            const displayHeight = Math.abs(element.height);

            return (
              <video
                key={`video-${index}`}
                src={element.src}
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                style={{
                  position: "absolute",
                  left: displayX,
                  top: displayY,
                  width: displayWidth,
                  height: displayHeight,
                  objectFit: "contain",
                  pointerEvents: "none",
                  zIndex: 1,
                }}
              />
            );
          })}
      </div>
    </div>
  );
}

export default UserWhiteBoard;