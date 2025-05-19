(function () {
    // DOM元素
    const canvas = document.getElementById('canvas');
    const fileInput = document.getElementById('file-input');
    const uploadArea = document.getElementById('upload-area');
    const placeholder = document.getElementById('placeholder');
    const convertBtn = document.getElementById('convert-btn');
    const downloadBtn = document.getElementById('download-btn');
    const vertexCountSlider = document.getElementById('vertex-count');
    const vertexCountValue = document.getElementById('vertex-count-value');
    const wireframeCheckbox = document.getElementById('wireframe');
    const progressContainer = document.getElementById('progress-container');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const imageTab = document.getElementById('image-tab');
    const videoTab = document.getElementById('video-tab');
    const sourceImg = document.getElementById('source-img');
    const sourceVideo = document.getElementById('source-video');

    // 状态变量
    let renderer = null;
    let isProcessing = false;
    let mediaType = 'image'; // 'image' 或 'video'
    let mediaSource = null;
    let isVideoPlaying = false;
    let animationFrameId = null;
    let vertexCount = 2000;
    let hasWireframe = false;

    // 检测WebGL支持
    function checkWebGLSupport() {
        try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext && 
                (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
        } catch(e) {
            return false;
        }
    }
    
    // 检测WebGL上下文创建是否成功
    function testWebGLContext() {
        try {
            const testCanvas = document.createElement('canvas');
            const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
            if (!gl) return false;
            
            // 测试创建着色器
            const vertexShader = gl.createShader(gl.VERTEX_SHADER);
            if (!vertexShader) return false;
            gl.deleteShader(vertexShader);
            
            return true;
        } catch(e) {
            console.error('测试WebGL上下文失败:', e);
            return false;
        }
    }
    
    // 全局变量标记是否使用备用方案
    let useCanvasFallback = false;
    
    // 初始化
    function init() {
        // 预先设置使用备用方案，防止WebGL创建失败
        useCanvasFallback = true;
        console.log('默认使用Canvas备用方案，确保兼容性');
        
        // 不再尝试使用WebGL，直接使用Canvas备用方案
        // if (!checkWebGLSupport()) {
        //     useCanvasFallback = true;
        //     console.log('浏览器不支持WebGL，将使用Canvas备用方案');
        // } else {
        //     // 测试WebGL上下文创建
        //     if (!testWebGLContext()) {
        //         useCanvasFallback = true;
        //         console.log('WebGL上下文创建失败，将使用Canvas备用方案');
        //     }
        // }
        
        // 设置canvas尺寸
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // 事件监听器
        fileInput.addEventListener('change', handleFileSelect);
        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', handleDragOver);
        uploadArea.addEventListener('drop', handleDrop);
        convertBtn.addEventListener('click', startConversion);
        downloadBtn.addEventListener('click', downloadResult);
        vertexCountSlider.addEventListener('input', updateVertexCount);
        wireframeCheckbox.addEventListener('change', toggleWireframe);
        imageTab.addEventListener('click', () => switchTab('image'));
        videoTab.addEventListener('click', () => switchTab('video'));

        // 初始禁用转换按钮
        convertBtn.disabled = true;
    }

    // 调整canvas尺寸
    function resizeCanvas() {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
        if (renderer) {
            renderer.resize();
        }
    }

    // 处理文件选择
    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        processFile(file);
    }

    // 处理拖放
    function handleDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        uploadArea.style.borderColor = '#157a6b';
    }

    function handleDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        uploadArea.style.borderColor = '#22C3AA';
        
        const file = event.dataTransfer.files[0];
        if (!file) return;
        
        processFile(file);
    }

    // 处理文件
    function processFile(file) {
        // 重置处理状态
        isProcessing = false;
        
        // 隐藏下载按钮和进度条
        downloadBtn.style.display = 'none';
        downloadBtn.classList.add('hidden');
        progressContainer.style.display = 'none';
        
        // 检查文件类型
        if (file.type.startsWith('image/')) {
            mediaType = 'image';
            switchTab('image');
            handleImageFile(file);
        } else if (file.type.startsWith('video/')) {
            mediaType = 'video';
            switchTab('video');
            handleVideoFile(file);
        } else {
            alert('请上传图片或视频文件');
            return;
        }

        // 启用转换按钮
        convertBtn.disabled = false;
    }

    // 处理图片文件
    function handleImageFile(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            sourceImg.onload = function() {
                placeholder.style.display = 'none';
                // 在canvas上显示原始图片
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // 计算图片在canvas中的位置和尺寸
                const scale = Math.min(
                    canvas.width / sourceImg.width,
                    canvas.height / sourceImg.height
                );
                const x = (canvas.width - sourceImg.width * scale) / 2;
                const y = (canvas.height - sourceImg.height * scale) / 2;
                
                ctx.drawImage(
                    sourceImg,
                    x, y,
                    sourceImg.width * scale,
                    sourceImg.height * scale
                );
                
                mediaSource = e.target.result;
            };
            sourceImg.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // 处理视频文件
    function handleVideoFile(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            sourceVideo.onloadedmetadata = function() {
                placeholder.style.display = 'none';
                
                // 停止之前的视频播放
                if (isVideoPlaying) {
                    cancelAnimationFrame(animationFrameId);
                    isVideoPlaying = false;
                }
                
                // 计算视频在canvas中的位置和尺寸
                const scale = Math.min(
                    canvas.width / sourceVideo.videoWidth,
                    canvas.height / sourceVideo.videoHeight
                );
                const x = (canvas.width - sourceVideo.videoWidth * scale) / 2;
                const y = (canvas.height - sourceVideo.videoHeight * scale) / 2;
                
                // 播放视频并在canvas上显示
                sourceVideo.play();
                isVideoPlaying = true;
                
                function drawVideo() {
                    if (!isVideoPlaying) return;
                    
                    const ctx = canvas.getContext('2d');
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(
                        sourceVideo,
                        x, y,
                        sourceVideo.videoWidth * scale,
                        sourceVideo.videoHeight * scale
                    );
                    
                    animationFrameId = requestAnimationFrame(drawVideo);
                }
                
                drawVideo();
                mediaSource = e.target.result;
            };
            sourceVideo.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // 切换标签
    function switchTab(tab) {
        if (tab === 'image') {
            imageTab.classList.add('active');
            videoTab.classList.remove('active');
            fileInput.accept = 'image/*';
            mediaType = 'image';
        } else {
            videoTab.classList.add('active');
            imageTab.classList.remove('active');
            fileInput.accept = 'video/*';
            mediaType = 'video';
        }
    }

    // 更新顶点数量
    function updateVertexCount() {
        vertexCount = parseInt(vertexCountSlider.value);
        vertexCountValue.textContent = vertexCount;
        
        if (renderer) {
            renderer.setVertexCnt(vertexCount);
        }
    }

    // 切换线框显示
    function toggleWireframe() {
        hasWireframe = wireframeCheckbox.checked;
        
        if (renderer) {
            renderer.setWireframe(hasWireframe);
        }
    }

    // 开始转换
    function startConversion() {
        if (isProcessing || !mediaSource) return;
        
        isProcessing = true;
        convertBtn.disabled = true;
        progressContainer.style.display = 'block';
        
        // 停止视频播放
        if (mediaType === 'video' && isVideoPlaying) {
            cancelAnimationFrame(animationFrameId);
            isVideoPlaying = false;
        }
        
        // 模拟进度
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += 1;
            if (progress > 99) {
                clearInterval(progressInterval);
            }
            progressFill.style.width = progress + '%';
            progressText.textContent = '处理中... ' + progress + '%';
        }, 30);
        
        try {
            // 创建渲染器
            const start = new Date();
            
            // 如果使用Canvas备用方案
            if (useCanvasFallback) {
                console.log('使用Canvas备用方案进行转换');
                renderer = new CanvasLowPoly(canvas, vertexCount);
                
                if (mediaType === 'image') {
                    // 确保图片已加载
                    if (!sourceImg.complete) {
                        sourceImg.onload = function() {
                            try {
                                renderer.updateImage(mediaSource, function() {
                                    finishConversion(start, progressInterval);
                                });
                                renderer.setWireframe(hasWireframe);
                            } catch (err) {
                                console.error('渲染器创建失败:', err);
                                finishConversion(start, progressInterval, true);
                            }
                        };
                    } else {
                        renderer.updateImage(mediaSource, function() {
                            finishConversion(start, progressInterval);
                        });
                        renderer.setWireframe(hasWireframe);
                    }
                } else {
                    // 停止之前的视频
                    if (sourceVideo.pause) sourceVideo.pause();
                    
                    // 创建视频渲染器
                    sourceVideo.currentTime = 0;
                    sourceVideo.play();
                    renderer.updateVideo(sourceVideo, function() {
                        finishConversion(start, progressInterval);
                    });
                    renderer.setWireframe(hasWireframe);
                }
            } else {
                // 使用WebGL渲染器
                if (mediaType === 'image') {
                    // 确保图片已加载
                    if (!sourceImg.complete) {
                        sourceImg.onload = function() {
                            try {
                                renderer = new GlRenderer(canvas, vertexCount, true, mediaSource, function() {
                                    finishConversion(start, progressInterval);
                                });
                                renderer.setWireframe(hasWireframe);
                            } catch (err) {
                                console.error('渲染器创建失败:', err);
                                // 如果失败，切换到Canvas备用方案
                                useCanvasFallback = true;
                                startConversion();
                            }
                        };
                    } else {
                        try {
                            renderer = new GlRenderer(canvas, vertexCount, true, mediaSource, function() {
                                finishConversion(start, progressInterval);
                            });
                            renderer.setWireframe(hasWireframe);
                        } catch (err) {
                            console.error('渲染器创建失败:', err);
                            // 如果失败，切换到Canvas备用方案
                            useCanvasFallback = true;
                            startConversion();
                        }
                    }
                } else {
                    // 停止之前的视频
                    if (sourceVideo.pause) sourceVideo.pause();
                    
                    try {
                        // 创建视频渲染器
                        sourceVideo.currentTime = 0;
                        sourceVideo.play();
                        renderer = new GlRenderer(canvas, vertexCount, false, sourceVideo, sourceVideo);
                        
                        // 视频渲染需要持续进行
                        function renderVideoFrame() {
                            if (!renderer) return;
                            renderer.render();
                            requestAnimationFrame(renderVideoFrame);
                        }
                        
                        setTimeout(() => {
                            finishConversion(start, progressInterval);
                            renderVideoFrame();
                        }, 1500);
                        
                        renderer.setWireframe(hasWireframe);
                    } catch (err) {
                        console.error('渲染器创建失败:', err);
                        // 如果失败，切换到Canvas备用方案
                        useCanvasFallback = true;
                        startConversion();
                    }
                }
            }
        } catch (err) {
            console.error('转换过程中出错:', err);
            finishConversion(new Date(), progressInterval, true);
        }
    }

    // 完成转换
    function finishConversion(startTime, progressInterval, hasError) {
        clearInterval(progressInterval);
        progressFill.style.width = '100%';
        
        const endTime = new Date();
        const time = ((endTime - startTime) / 1000).toFixed(2);
        
        if (hasError) {
            progressText.textContent = '处理失败，请重试';
            console.log('转换过程中出现错误');
        } else {
            progressText.textContent = '处理完成! 耗时: ' + time + ' 秒';
            // 显示下载按钮
            downloadBtn.style.display = 'inline-block';
            downloadBtn.classList.remove('hidden');
        }
        
        isProcessing = false;
        convertBtn.disabled = false;
    }

    // 下载结果
    function downloadResult() {
        if (!renderer) return;
        
        // 创建一个临时链接来下载canvas内容
        const link = document.createElement('a');
        
        if (mediaType === 'image') {
            link.download = 'lowpoly-image-' + new Date().getTime() + '.png';
            link.href = canvas.toDataURL('image/png');
        } else {
            // 对于视频，我们只能下载当前帧
            link.download = 'lowpoly-video-frame-' + new Date().getTime() + '.png';
            link.href = canvas.toDataURL('image/png');
            alert('注意：目前只能下载视频的当前帧。完整视频下载功能正在开发中。');
        }
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // 初始化应用
    init();
})();
