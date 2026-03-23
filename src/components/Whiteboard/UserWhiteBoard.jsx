import { useEffect, useLayoutEffect, useRef } from "react";
import rough from "roughjs/bundled/rough.esm";

const roughGenerator = rough.generator();

function UserWhiteBoard({ socket, user, ctxRef, elements, setElements, color, setColor }) {

    const imagesCache = useRef({});
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;

            const ctx = canvas.getContext("2d");
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.lineCap = "round";

            ctxRef.current = ctx;
        }
    }, []);

    useEffect(() => {
        socket.on("colorChange", (data) => {
            const { color } = data;
            setColor(color);
            if (canvasRef.current) ctxRef.current.strokeStyle = color;
        });

        socket.on("WhiteboardElements", (data) => {
            const { elements } = data;
            console.log("Received elements from server:", elements);
            setElements(elements);
        });
    }, [socket]);

    useLayoutEffect(() => {
        if (!canvasRef.current || !ctxRef.current) return;

        const canvas = canvasRef.current;
        const ctx = ctxRef.current;
        const roughCanvas = rough.canvas(canvas);

        // Clear canvas before drawing
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let imagesToLoad = 0;

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
                const drawX = Math.min(element.offsetX, element.offsetX + element.width);
                const drawY = Math.min(element.offsetY, element.offsetY + element.height);
                const drawWidth = Math.abs(element.width);
                const drawHeight = Math.abs(element.height);

                if (!imagesCache.current[element.src]) {
                    imagesToLoad++;
                    const imageObj = new Image();
                    imageObj.src = element.src;
                    imageObj.onload = () => {
                        imagesCache.current[element.src] = imageObj;
                        // Force re-render to display the newly loaded image
                        setElements(prevElements => [...prevElements]);
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
            } else if (element.type === "text") {
                ctx.fillStyle = element.color;
                const textFontSize = element.fontSize || 20;
                const textFontFamily = element.fontFamily || "Arial";
                ctx.font = `${textFontSize}px ${textFontFamily}`;
                ctx.fillText(element.text, element.offsetX, element.offsetY);
            }
        });
    }, [elements]);

    return (
        <div
            style={{ height: "100vh", width: "100vw", overflow: "hidden", position: "relative", backgroundColor: "white" }}
            className={`shadow-lg ${!user?.presenter ? "pointer-events-none" : ""}`}
        >
            <canvas 
                ref={canvasRef}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    zIndex: 2,
                    backgroundColor: 'transparent'
                }}
            ></canvas>
            
            {/* Render video elements */}
            {elements.filter(el => el.type === 'video').map((element, index) => {
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
                            position: 'absolute',
                            left: `${displayX}px`,
                            top: `${displayY}px`,
                            width: `${displayWidth}px`,
                            height: `${displayHeight}px`,
                            objectFit: 'contain',
                            pointerEvents: 'none',
                            zIndex: 1,
                        }}
                    />
                );
            })}
        </div>
    );
}

export default UserWhiteBoard
