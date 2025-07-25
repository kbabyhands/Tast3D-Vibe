import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { SplatMesh } from '@sparkjsdev/spark';
import { OrbitControls } from 'three-stdlib';

interface SplatViewerProps {
  splatUrl?: string;
  width?: number;
  height?: number;
  className?: string;
  autoRotate?: boolean;
  enableControls?: boolean; // New prop to enable manual controls
}

const SplatViewer: React.FC<SplatViewerProps> = ({ 
  splatUrl, 
  width = 800, 
  height = 400, 
  className = '',
  autoRotate = true,
  enableControls = true // Default to enabled
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const splatMeshRef = useRef<SplatMesh | THREE.Group | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState('');

  useEffect(() => {
    let mounted = true;

    const initializeViewer = async () => {
      if (!mountRef.current) return;

      try {
        setIsLoading(true);
        setError(null);
        setLoadingStep('Initializing...');

        console.log('SparkJS modules loaded successfully');

        // Create scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a1a); // Dark background to match theme
        
        // Create camera
        const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
        camera.position.set(0, 0, 3);
        
        // Create renderer with maximum performance settings
        const renderer = new THREE.WebGLRenderer({ 
          antialias: false, // Disable for speed
          alpha: false,
          powerPreference: "high-performance",
          stencil: false,
          depth: true,
          logarithmicDepthBuffer: false,
          preserveDrawingBuffer: false,
          failIfMajorPerformanceCaveat: false
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Limit for performance
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        
        // Disable expensive features for speed
        renderer.shadowMap.enabled = false;
        renderer.physicallyCorrectLights = false;
        renderer.toneMapping = THREE.NoToneMapping; // Fastest
        
        // Clear any existing content
        mountRef.current.innerHTML = '';
        mountRef.current.appendChild(renderer.domElement);
        
        // Add lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 5, 5);
        scene.add(directionalLight);

        // Store references
        sceneRef.current = scene;
        rendererRef.current = renderer;

        // Add orbit controls for full 360° rotation
        if (enableControls) {
          const controls = new OrbitControls(camera, renderer.domElement);
          controls.enableDamping = false; // Disable for performance
          controls.screenSpacePanning = false;
          controls.minDistance = 0.5;
          controls.maxDistance = 20;
          controls.minPolarAngle = 0;
          controls.maxPolarAngle = Math.PI;
          controls.minAzimuthAngle = -Infinity;
          controls.maxAzimuthAngle = Infinity;
          controls.autoRotate = false;
          controls.autoRotateSpeed = 0;
          controlsRef.current = controls;
        }

        // Check if we have a splat/PLY file to load
        if (splatUrl && (splatUrl.includes('.ply') || splatUrl.includes('.splat') || splatUrl.includes('.spz') || splatUrl.includes('.ksplat'))) {
          try {
            setLoadingStep('Loading model...');
            
            // Construct the full URL for file serving
            let fileUrl = splatUrl;
            if (splatUrl.startsWith('/uploads/')) {
              const BACKEND_URL = import.meta.env.VITE_REACT_APP_BACKEND_URL || process.env.REACT_APP_BACKEND_URL;
              fileUrl = `${BACKEND_URL}/api/homepage${splatUrl}`;
              console.log('Loading model from URL:', fileUrl);
            }
            
            // Skip file accessibility test for speed - just load directly
            setLoadingStep('Creating mesh...');
            
            // Create SplatMesh with maximum performance settings
            const splatMesh = new SplatMesh({ 
              url: fileUrl,
              // Aggressive optimization settings for fastest loading
              alphaTest: 0.2, // Higher for better performance
              alphaHash: false, // Disable for speed
              halfFloat: true,
              // Additional performance optimizations
              sphericalHarmonics: false, // Disable for speed
              renderMode: 'basic', // Use basic render mode
              progressiveLoad: true, // Enable progressive loading
              maxSplats: 1000000, // Limit splats for performance
            });
            
            // Fix orientation: Rotate 180 degrees around X-axis to make it upright
            splatMesh.position.set(0, 0, 0);
            splatMesh.rotation.x = Math.PI; // 180 degrees around X-axis only
            splatMesh.scale.set(1, 1, 1);
            
            // Add to scene immediately
            scene.add(splatMesh);
            splatMeshRef.current = splatMesh;
            
            setLoadingStep('Complete!');
            console.log('Splat mesh added to scene successfully');
            
          } catch (splatError) {
            console.error('Splat loading failed:', splatError);
            setError(`Model loading failed: ${splatError.message || 'Unknown error'}`);
            createDefaultScene(scene);
          }
        } else {
          // Create default scene for non-splat files or no file
          setLoadingStep('Creating scene...');
          createDefaultScene(scene);
        }

        // Ultra-fast animation loop
        const animate = () => {
          if (!mounted) return;
          
          // Always update controls for smooth interaction
          if (controlsRef.current) {
            controlsRef.current.update();
          }
          
          // Always slowly rotate the splat model
          if (autoRotate && splatMeshRef.current) {
            splatMeshRef.current.rotation.y += 0.003;
          }
          
          // Animate default scene particles if it's a group
          if (splatMeshRef.current instanceof THREE.Group && splatMeshRef.current.children) {
            splatMeshRef.current.children.forEach((child: any, index: number) => {
              if (index > 1) {
                child.rotation.x += 0.005;
                child.rotation.y += 0.003;
              }
            });
          }
          
          renderer.render(scene, camera);
          animationIdRef.current = requestAnimationFrame(animate);
        };
        
        animate();
        setIsLoading(false);

      } catch (err) {
        console.error('Error initializing SplatViewer:', err);
        setError(`SparkJS initialization failed: ${err.message || 'Unknown error'}`);
        setIsLoading(false);
      }
    };

    // Helper function to create default scene
    const createDefaultScene = (scene: THREE.Scene) => {
      const group = new THREE.Group();

      // Main sphere (represents 3D food model)
      const sphereGeometry = new THREE.SphereGeometry(0.8, 32, 32);
      const sphereMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x4f46e5,
        transparent: true,
        opacity: 0.8,
        shininess: 100
      });
      const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
      group.add(sphere);
      
      // Wireframe overlay for tech aesthetic
      const wireframeGeometry = new THREE.SphereGeometry(0.82, 16, 16);
      const wireframeMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x60a5fa, 
        wireframe: true,
        transparent: true,
        opacity: 0.4
      });
      const wireframe = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
      group.add(wireframe);

      // Add some floating particles around the sphere
      const particleGeometry = new THREE.SphereGeometry(0.02, 8, 8);
      const particleMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x60a5fa,
        transparent: true,
        opacity: 0.6
      });

      for (let i = 0; i < 20; i++) {
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        particle.position.set(
          (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 3
        );
        group.add(particle);
      }

      scene.add(group);
      splatMeshRef.current = group;
    };

    // Initialize the viewer immediately
    initializeViewer();

    return () => {
      mounted = false;
      
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      
      if (controlsRef.current) {
        controlsRef.current.dispose();
      }
      
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      
      if (mountRef.current) {
        mountRef.current.innerHTML = '';
      }
    };
  }, [splatUrl, width, height, autoRotate, enableControls]);

  if (error) {
    return (
      <div 
        className={`flex items-center justify-center bg-gray-800 rounded-2xl border-2 border-gray-700 ${className}`}
        style={{ width, height }}
      >
        <div className="text-center p-4">
          <div className="text-red-400 text-lg mb-2">⚠️</div>
          <p className="text-gray-400 text-sm mb-2">3D Viewer Error</p>
          <p className="text-gray-500 text-xs">{error}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div 
        className={`flex items-center justify-center bg-gray-800 rounded-2xl border-2 border-gray-700 ${className}`}
        style={{ width, height }}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-2"></div>
          <p className="text-gray-400 text-sm">Loading 3D Model...</p>
          {loadingStep && (
            <p className="text-gray-500 text-xs mt-1">{loadingStep}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={mountRef} 
      className={`rounded-2xl overflow-hidden border-2 border-gray-700 ${className}`}
      style={{ width, height }}
    />
  );
};

export default SplatViewer;