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
        });
    }, [elements]);

    return (
        <div
            style={{ height: "100vh", width: "100vw", overflow: "hidden" }}
            className={`shadow-lg ${!user?.presenter ? "pointer-events-none" : ""}`}
        >
            <canvas className="bg-white" ref={canvasRef}></canvas>
        </div>
    );
}

export default UserWhiteBoard
