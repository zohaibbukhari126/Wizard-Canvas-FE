import React, { useRef, useState } from "react";
import Draggable from "react-draggable";

const DraggableComponent = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const draggableRef = useRef(null);

  const handleDragStop = (e: any, data: { x: number; y: number }) => {
    setPosition({ x: data.x, y: data.y });
  };

  return (
    <Draggable position={position} onStop={handleDragStop}>
      <div ref={draggableRef} style={{ width: "100px", height: "100px", background: "blue" }}>
        Drag me
      </div>
    </Draggable>
  );
};

export default DraggableComponent;
