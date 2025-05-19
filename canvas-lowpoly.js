/**
 * Canvas Low-Poly转换器
 * 当WebGL不可用时的备用方案
 */
class CanvasLowPoly {
    constructor(canvas, vertexCount) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.vertexCount = vertexCount || 1000;
        this.sourceImage = null;
        this.sourceVideo = null;
        this.isImage = true;
        this.wireframe = false;
        this.triangles = [];
        this.vertices = [];
    }

    // 设置顶点数量
    setVertexCount(count) {
        this.vertexCount = count;
    }

    // 设置线框显示
    setWireframe(show) {
        this.wireframe = show;
        if (this.triangles.length > 0) {
            this.renderTriangles();
        }
    }

    // 更新图像源
    updateImage(imgSource, callback) {
        this.isImage = true;
        const img = new Image();
        img.onload = () => {
            this.sourceImage = img;
            this.processImage();
            if (callback) callback();
        };
        img.src = imgSource;
    }

    // 更新视频源
    updateVideo(video, callback) {
        this.isImage = false;
        this.sourceVideo = video;
        this.processVideo();
        if (callback) callback();
    }

    // 处理图像
    processImage() {
        if (!this.sourceImage) return;

        // 调整canvas大小以适应图像
        const imgRatio = this.sourceImage.width / this.sourceImage.height;
        const canvasRatio = this.canvas.width / this.canvas.height;

        let renderWidth, renderHeight, offsetX, offsetY;

        if (canvasRatio > imgRatio) {
            renderHeight = this.canvas.height;
            renderWidth = renderHeight * imgRatio;
            offsetX = (this.canvas.width - renderWidth) / 2;
            offsetY = 0;
        } else {
            renderWidth = this.canvas.width;
            renderHeight = renderWidth / imgRatio;
            offsetX = 0;
            offsetY = (this.canvas.height - renderHeight) / 2;
        }

        // 绘制原始图像到临时canvas以获取像素数据
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.sourceImage.width;
        tempCanvas.height = this.sourceImage.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(this.sourceImage, 0, 0);
        
        // 获取图像数据
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        
        // 生成顶点
        this.generateVertices(imageData, tempCanvas.width, tempCanvas.height);
        
        // 生成三角形
        this.triangulate();
        
        // 渲染三角形
        this.renderTriangles(renderWidth, renderHeight, offsetX, offsetY);
    }

    // 处理视频
    processVideo() {
        if (!this.sourceVideo) return;
        
        // 在视频帧上绘制
        const drawFrame = () => {
            if (!this.sourceVideo) return;
            
            // 调整canvas大小以适应视频
            const videoRatio = this.sourceVideo.videoWidth / this.sourceVideo.videoHeight;
            const canvasRatio = this.canvas.width / this.canvas.height;

            let renderWidth, renderHeight, offsetX, offsetY;

            if (canvasRatio > videoRatio) {
                renderHeight = this.canvas.height;
                renderWidth = renderHeight * videoRatio;
                offsetX = (this.canvas.width - renderWidth) / 2;
                offsetY = 0;
            } else {
                renderWidth = this.canvas.width;
                renderHeight = renderWidth / videoRatio;
                offsetX = 0;
                offsetY = (this.canvas.height - renderHeight) / 2;
            }

            // 绘制视频帧到临时canvas
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = this.sourceVideo.videoWidth;
            tempCanvas.height = this.sourceVideo.videoHeight;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(this.sourceVideo, 0, 0);
            
            // 获取帧数据
            const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            
            // 生成顶点
            this.generateVertices(imageData, tempCanvas.width, tempCanvas.height);
            
            // 生成三角形
            this.triangulate();
            
            // 渲染三角形
            this.renderTriangles(renderWidth, renderHeight, offsetX, offsetY);
            
            // 继续下一帧
            requestAnimationFrame(drawFrame);
        };
        
        drawFrame();
    }

    // 生成顶点
    generateVertices(imageData, width, height) {
        // 清除之前的顶点
        this.vertices = [];
        
        // 添加四个角落的顶点
        this.vertices.push([0, 0]);
        this.vertices.push([0, 1]);
        this.vertices.push([1, 0]);
        this.vertices.push([1, 1]);
        
        // 基于亮度差异添加顶点
        const data = imageData.data;
        const edgeThreshold = 30; // 边缘检测阈值
        
        // 简单的边缘检测
        const edges = new Uint8Array(width * height);
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = (y * width + x) * 4;
                const idxLeft = (y * width + (x - 1)) * 4;
                const idxRight = (y * width + (x + 1)) * 4;
                const idxUp = ((y - 1) * width + x) * 4;
                const idxDown = ((y + 1) * width + x) * 4;
                
                // 计算相邻像素的亮度差异
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                const brightness = (r + g + b) / 3;
                
                const rLeft = data[idxLeft];
                const gLeft = data[idxLeft + 1];
                const bLeft = data[idxLeft + 2];
                const brightnessLeft = (rLeft + gLeft + bLeft) / 3;
                
                const rRight = data[idxRight];
                const gRight = data[idxRight + 1];
                const bRight = data[idxRight + 2];
                const brightnessRight = (rRight + gRight + bRight) / 3;
                
                const rUp = data[idxUp];
                const gUp = data[idxUp + 1];
                const bUp = data[idxUp + 2];
                const brightnessUp = (rUp + gUp + bUp) / 3;
                
                const rDown = data[idxDown];
                const gDown = data[idxDown + 1];
                const bDown = data[idxDown + 2];
                const brightnessDown = (rDown + gDown + bDown) / 3;
                
                // 计算差异
                const diffH = Math.abs(brightnessLeft - brightnessRight);
                const diffV = Math.abs(brightnessUp - brightnessDown);
                
                // 如果差异大于阈值，标记为边缘
                if (diffH > edgeThreshold || diffV > edgeThreshold) {
                    edges[y * width + x] = 255;
                }
            }
        }
        
        // 基于边缘添加顶点
        const maxVertices = this.vertexCount - 4; // 减去四个角落的顶点
        let addedVertices = 0;
        
        // 先添加边缘顶点
        for (let i = 0; i < 100 && addedVertices < maxVertices * 0.7; i++) {
            const x = Math.floor(Math.random() * width);
            const y = Math.floor(Math.random() * height);
            
            if (edges[y * width + x] > 0) {
                this.vertices.push([x / width, y / height]);
                addedVertices++;
            }
        }
        
        // 添加随机顶点填充剩余空间
        while (addedVertices < maxVertices) {
            const x = Math.random();
            const y = Math.random();
            this.vertices.push([x, y]);
            addedVertices++;
        }
    }

    // 三角剖分
    triangulate() {
        // 简单的三角剖分算法
        this.triangles = [];
        
        // 使用Delaunay三角剖分（如果可用）
        if (typeof Delaunay !== 'undefined') {
            try {
                const indices = Delaunay.triangulate(this.vertices);
                for (let i = 0; i < indices.length; i += 3) {
                    this.triangles.push([
                        this.vertices[indices[i]],
                        this.vertices[indices[i + 1]],
                        this.vertices[indices[i + 2]]
                    ]);
                }
                return;
            } catch (e) {
                console.error('Delaunay三角剖分失败:', e);
            }
        }
        
        // 备用方案：简单的随机三角剖分
        const vertexCount = this.vertices.length;
        for (let i = 0; i < vertexCount - 2; i++) {
            for (let j = i + 1; j < vertexCount - 1; j++) {
                for (let k = j + 1; k < vertexCount && this.triangles.length < this.vertexCount * 2; k++) {
                    if (Math.random() < 0.01) { // 只使用一小部分组合以避免过多三角形
                        this.triangles.push([
                            this.vertices[i],
                            this.vertices[j],
                            this.vertices[k]
                        ]);
                    }
                }
            }
        }
    }

    // 渲染三角形
    renderTriangles(renderWidth, renderHeight, offsetX, offsetY) {
        if (!this.ctx) return;
        
        // 清除画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 如果没有提供参数，使用默认值
        renderWidth = renderWidth || this.canvas.width;
        renderHeight = renderHeight || this.canvas.height;
        offsetX = offsetX || 0;
        offsetY = offsetY || 0;
        
        // 获取源图像/视频
        const source = this.isImage ? this.sourceImage : this.sourceVideo;
        if (!source) return;
        
        // 获取源尺寸
        const sourceWidth = this.isImage ? source.width : source.videoWidth;
        const sourceHeight = this.isImage ? source.height : source.videoHeight;
        
        // 创建临时canvas获取像素颜色
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = sourceWidth;
        tempCanvas.height = sourceHeight;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(source, 0, 0);
        
        // 绘制每个三角形
        for (const triangle of this.triangles) {
            // 计算三角形中心点
            const centerX = (triangle[0][0] + triangle[1][0] + triangle[2][0]) / 3;
            const centerY = (triangle[0][1] + triangle[1][1] + triangle[2][1]) / 3;
            
            // 获取中心点颜色
            const sourceX = Math.floor(centerX * sourceWidth);
            const sourceY = Math.floor(centerY * sourceHeight);
            const pixel = tempCtx.getImageData(sourceX, sourceY, 1, 1).data;
            const color = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
            
            // 转换顶点坐标到渲染尺寸
            const v1 = [triangle[0][0] * renderWidth + offsetX, triangle[0][1] * renderHeight + offsetY];
            const v2 = [triangle[1][0] * renderWidth + offsetX, triangle[1][1] * renderHeight + offsetY];
            const v3 = [triangle[2][0] * renderWidth + offsetX, triangle[2][1] * renderHeight + offsetY];
            
            // 绘制填充三角形
            this.ctx.beginPath();
            this.ctx.moveTo(v1[0], v1[1]);
            this.ctx.lineTo(v2[0], v2[1]);
            this.ctx.lineTo(v3[0], v3[1]);
            this.ctx.closePath();
            this.ctx.fillStyle = color;
            this.ctx.fill();
            
            // 如果启用线框，绘制三角形边框
            if (this.wireframe) {
                this.ctx.strokeStyle = '#ffff00';
                this.ctx.lineWidth = 0.5;
                this.ctx.stroke();
            }
        }
    }

    // 渲染方法（用于与GlRenderer兼容）
    render(callback) {
        if (this.isImage) {
            this.processImage();
        } else {
            this.processVideo();
        }
        
        if (callback) callback();
    }
}

// 导出类
window.CanvasLowPoly = CanvasLowPoly;
