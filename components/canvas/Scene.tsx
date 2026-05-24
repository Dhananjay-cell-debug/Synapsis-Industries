import * as THREE from "three";
import HeroModel from "./HeroModel";

export default function Scene({ groundColor = "#11B8EA", bgColor = "#0A0F1E" }: { groundColor?: string, bgColor?: string }) {
    return (
        <>
            <color attach="background" args={[bgColor]} />

            {/* Cool ambient — slightly blue-white, sets the tone */}
            <ambientLight intensity={0.6} color="#C8D8F0" />

            {/* KEY light — cool-white from upper-right, crisp highlights */}
            <directionalLight
                position={[6, 8, 8]}
                intensity={0.7}
                color="#E0EEFF"
            />

            {/* FILL light — brand azure from left */}
            <directionalLight position={[-5, 3, 6]} intensity={0.4} color="#11B8EA" />

            {/* RIM light — royal blue backlight for edge definition */}
            <directionalLight position={[0, 5, -5]} intensity={0.25} color="#3B6AE8" />

            {/* BOTTOM bounce — deep navy uplight */}
            <directionalLight position={[0, -3, 5]} intensity={0.12} color="#0D1526" />

            {/* Hemisphere light — cool sky, deep ground */}
            <hemisphereLight args={["#C8D8F0", "#0A0F1E", 0.35]} />

            {/* Ground Floor */}
            <mesh position={[0, -2.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[500, 500]} />
                <meshStandardMaterial color={groundColor} roughness={0.85} />
            </mesh>

            {/* Draco Loader Ready Hero Model */}
            <HeroModel />
        </>
    );
}
