

// 全局变量
let uploadedFiles = [];
let currentWorkflow = 'none';

// 简化调试功能
const DEBUG_MODE = false;

function debugLog(message) {
    if (!DEBUG_MODE) return;
    console.log('[DEBUG]', message);
}

// 文件处理函数
function processFiles(files) {
    debugLog(`开始处理 ${files.length} 个文件`);
    
    if (!files || files.length === 0) {
        debugLog('没有文件需要处理');
        return;
    }
    
    // 清空之前的文件
    uploadedFiles = [];
    
    // 检测工作流类型
    const hasPDF = Array.from(files).some(file => file.type === 'application/pdf');
    const hasODF = Array.from(files).some(file => 
        file.type === 'application/vnd.oasis.opendocument.formula' || 
        file.name.toLowerCase().endsWith('.odf')
    );
    
    currentWorkflow = hasPDF ? 'pdf' : (hasODF ? 'odf' : 'image');
    debugLog(`检测到工作流类型: ${currentWorkflow}`);
    
    // 处理每个文件
    Array.from(files).forEach((file, index) => {
        debugLog(`处理文件 ${index + 1}: ${file.name} (${file.size} bytes, ${file.type})`);
        
        const fileObj = {
            file: file,
            name: file.name,
            size: file.size,
            type: file.type,
            id: Date.now() + index
        };
        
        uploadedFiles.push(fileObj);
        
        // 如果是图片，创建预览
        if (file.type.startsWith('image/')) {
            createImagePreview(fileObj);
        } else if (file.type === 'application/pdf') {
            createPDFPreview(fileObj);
        } else if (file.type === 'application/vnd.oasis.opendocument.formula' || 
                   file.name.toLowerCase().endsWith('.odf')) {
            // 处理ODF文件
            createODFPreview(fileObj);
        }
    });
    
    debugLog(`文件处理完成，共 ${uploadedFiles.length} 个文件`);
    updateFileList();
    
    // 根据工作流类型自动执行相应操作
    if (currentWorkflow === 'pdf') {
        debugLog('启动PDF自动合并流程');
        setTimeout(mergePDFs, 500);
    } else if (currentWorkflow === 'odf') {
        debugLog('启动ODF自动处理流程');
        setTimeout(processODFFiles, 500);
    }
}

// 创建图片预览
function createImagePreview(fileObj) {
    const reader = new FileReader();
    reader.onload = function(e) {
        fileObj.preview = e.target.result;
        debugLog(`图片预览创建完成: ${fileObj.name}`);
    };
    reader.readAsDataURL(fileObj.file);
}

// 创建PDF预览
function createPDFPreview(fileObj) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const typedarray = new Uint8Array(e.target.result);
        
        pdfjsLib.getDocument(typedarray).promise.then(function(pdf) {
            debugLog(`PDF加载成功: ${fileObj.name}, 页数: ${pdf.numPages}`);
            fileObj.pdfDoc = pdf;
            fileObj.numPages = pdf.numPages;
            
            // 生成第一页的预览图像 - 使用超高清晰度渲染
            pdf.getPage(1).then(function(page) {
                // 大幅提升缩放比例以获得超高清预览质量
                const scale = 3.0; // 提升到3倍缩放，显著提高清晰度
                const viewport = page.getViewport({scale: scale});
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                
                const devicePixelRatio = window.devicePixelRatio || 1;
                const finalScale = scale * Math.max(devicePixelRatio, 2); // 确保至少2倍DPI
                
                // 重新计算viewport以获得最高质量
                const highQualityViewport = page.getViewport({scale: finalScale});
                
                // 设置canvas尺寸为高质量尺寸
                canvas.width = highQualityViewport.width;
                canvas.height = highQualityViewport.height;
                canvas.style.width = viewport.width + 'px';
                canvas.style.height = viewport.height + 'px';
                
                // 启用图像平滑和高质量渲染
                context.imageSmoothingEnabled = true;
                context.imageSmoothingQuality = 'high';
                
                const renderContext = {
                    canvasContext: context,
                    viewport: highQualityViewport
                };
                
                page.render(renderContext).promise.then(function() {
                    // 将canvas转换为最高质量的data URL
                    const previewUrl = canvas.toDataURL('image/png', 1.0); // 100%质量
                    fileObj.preview = previewUrl;
                    debugLog(`PDF页面超高清预览生成成功: ${fileObj.name}, 缩放${finalScale.toFixed(1)}x`);
                });
            });
        }).catch(function(error) {
            debugLog(`PDF加载失败: ${fileObj.name}, 错误: ${error.message}`);
        });
    };
    reader.readAsArrayBuffer(fileObj.file);
}

// 更新文件列表显示
function updateFileList() {
    const container = document.getElementById('uploadedFiles');
    if (!container) return;
    
    container.innerHTML = '<h3>已上传的文件</h3>';
    
    uploadedFiles.forEach(fileObj => {
        const fileDiv = document.createElement('div');
        fileDiv.className = 'file-item';
        fileDiv.innerHTML = `
            <div class="file-info">
                <span class="file-name">${fileObj.name}</span>
                <span class="file-size">${(fileObj.size / 1024).toFixed(1)} KB</span>
                <span class="file-type">${fileObj.type}</span>
            </div>
            <button onclick="removeFile(${fileObj.id})" class="remove-btn">删除</button>
        `;
        container.appendChild(fileDiv);
    });
    
    container.style.display = uploadedFiles.length > 0 ? 'block' : 'none';
}

// 删除文件
function removeFile(fileId) {
    uploadedFiles = uploadedFiles.filter(f => f.id !== fileId);
    updateFileList();
    debugLog(`文件已删除，剩余 ${uploadedFiles.length} 个文件`);
}

// 清空所有文件
function clearAllFiles() {
    uploadedFiles = [];
    currentWorkflow = 'none';
    updateFileList();
    
    const previewSection = document.getElementById('previewSection');
    if (previewSection) {
        previewSection.style.display = 'none';
    }
    
    debugLog('所有文件已清空');
}

// PDF合并功能
function mergePDFs() {
    const pdfFiles = uploadedFiles.filter(f => f.type === 'application/pdf');
    if (pdfFiles.length === 0) {
        debugLog('没有PDF文件需要合并');
        return;
    }
    
    debugLog(`开始合并 ${pdfFiles.length} 个PDF文件`);
    
        // 检查是否已加载pdf-lib库
    if (typeof window.PDFLib === 'undefined') {
        // 尝试使用本地pdf-lib库
        if (typeof window.pdfLib !== 'undefined') {
            window.PDFLib = window.pdfLib;
            debugLog('使用本地pdf-lib库');
            performPDFMerge(pdfFiles);
        } else {
            debugLog('pdf-lib库未找到，PDF合并功能不可用');
            alert('PDF合并功能需要pdf-lib库支持');
        }
    } else {
        performPDFMerge(pdfFiles);
    }
}

// 执行PDF合并操作
function performPDFMerge(pdfFiles) {
    // 等待所有PDF文档加载完成
    const loadedDocs = pdfFiles.filter(file => file.pdfDoc);
    
    if (loadedDocs.length !== pdfFiles.length) {
        debugLog(`警告：只有 ${loadedDocs.length}/${pdfFiles.length} 个PDF文件加载完成`);
        alert('部分PDF文件尚未完全加载，可能影响合并结果');
    }
    
    // 显示处理状态
    showProcessingStatus('正在合并PDF文件...');
    
    // 使用pdf-lib进行实际的PDF合并
    async function mergePdfsWithLib() {
        try {
            // 创建一个新的PDF文档
            const mergedPdfDoc = await PDFLib.PDFDocument.create();
            
            // 遍历所有PDF文件
            for (const fileObj of pdfFiles) {
                if (fileObj.file) {
                    // 读取PDF文件数据
                    const arrayBuffer = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result);
                        reader.onerror = reject;
                        reader.readAsArrayBuffer(fileObj.file);
                    });
                    
                    // 将PDF文件添加到合并文档中
                    const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
                    const pages = await mergedPdfDoc.copyPages(pdfDoc, pdfDoc.getPageIndices());
                    pages.forEach(page => mergedPdfDoc.addPage(page));
                    
                    debugLog(`已添加文件到合并文档: ${fileObj.name}`);
                }
            }
            
            // 保存合并后的PDF
            const mergedPdfBytes = await mergedPdfDoc.save();
            
            // 创建Blob并设置预览
            const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            
            // 在上传文件列表中标记为合并结果
            debugLog('PDF文件合并完成');
            
            // 隐藏处理状态
            hideProcessingStatus();
            
            // 合并完成，不显示提示对话框
            debugLog(`已成功合并 ${pdfFiles.length} 个PDF文件`);
            
            // 合并完成，用户可以点击预览按钮查看结果
        } catch (error) {
            debugLog(`PDF合并失败: ${error.message}`);
            hideProcessingStatus();
            alert(`PDF合并失败: ${error.message}`);
        }
    }
    
    // 调用合并函数
    mergePdfsWithLib();
}

// 显示处理状态
function showProcessingStatus(message) {
    const statusElement = document.getElementById('processingStatus');
    const statusTextElement = document.getElementById('statusText');
    
    if (statusElement && statusTextElement) {
        statusTextElement.textContent = message || '正在处理...';
        statusElement.style.display = 'block';
    }
}

// 隐藏处理状态
function hideProcessingStatus() {
    const statusElement = document.getElementById('processingStatus');
    if (statusElement) {
        statusElement.style.display = 'none';
    }
}

// 生成预览
function generatePreview() {
    if (uploadedFiles.length === 0) {
        alert('请先上传文件');
        return;
    }
    
    debugLog('开始生成预览');
    
    const previewSection = document.getElementById('previewSection');
    const previewPagesElement = document.getElementById('previewPages');
    
    if (!previewSection || !previewPagesElement) {
        debugLog('预览容器不存在');
        return;
    }
    
    previewPagesElement.innerHTML = '';
    
    // 根据发票数量自动确定布局 - 固定A4竖版排版
    let layout;
    const orientation = 'portrait'; // 固定为A4竖版
    
    // 自动排版逻辑：
    // 1张发票：单张置顶居中
    // 2张及以上发票：2张一页，默认A4竖版
    if (uploadedFiles.length === 1) {
        layout = 'single';
        debugLog('1张发票：使用单页布局，置顶居中');
    } else {
        layout = 'double'; // 2张及以上使用双页布局
        debugLog(`${uploadedFiles.length}张发票：使用双页布局，每页2张`);
    }
    
    debugLog(`最终使用布局: ${layout}, 方向: ${orientation}`);
    
    // 根据布局生成预览页面
    const itemsPerPage = layout === 'single' ? 1 : layout === 'double' ? 2 : 4;
    
    // 计数器，用于跟踪已处理的文件数量
    let processedCount = 0;
    const totalFiles = uploadedFiles.length;
    
    // 显示处理状态
    showProcessingStatus('正在生成预览...');
    
    // 为每个文件生成预览页面
    for (let i = 0; i < uploadedFiles.length; i += itemsPerPage) {
        const pageDiv = document.createElement('div');
        pageDiv.className = `preview-page layout-${layout} orientation-${orientation}`;
        
        // 设置页面样式以适配A4纸张
        const pageStyle = getA4PageStyle(layout, orientation);
        Object.assign(pageDiv.style, pageStyle);
        
        for (let j = 0; j < itemsPerPage && i + j < uploadedFiles.length; j++) {
            const fileObj = uploadedFiles[i + j];
            const itemDiv = document.createElement('div');
            
            // 根据布局设置发票项样式
            const itemStyle = getInvoiceItemStyle(layout, j, itemsPerPage);
            itemDiv.className = `preview-item ${layout === 'single' ? 'single-center' : ''}`;
            Object.assign(itemDiv.style, itemStyle);
            
            // 处理预览内容
            if (fileObj.preview) {
                // 如果已有预览，直接使用并优化显示
                const img = document.createElement('img');
                img.src = fileObj.preview;
                img.alt = fileObj.name;
                img.style.cssText = 'width: 100%; height: 100%; object-fit: contain; border: none;';
                itemDiv.appendChild(img);
                processedCount++;
            } else if (fileObj.pdfDoc) {
                // 如果是PDF文件但没有预览，生成预览
                generatePDFPagePreview(fileObj, 1).then(previewUrl => {
                    fileObj.preview = previewUrl;
                    const img = document.createElement('img');
                    img.src = previewUrl;
                    img.alt = fileObj.name;
                    img.style.cssText = 'width: 100%; height: 100%; object-fit: contain; border: none;';
                    itemDiv.appendChild(img);
                    processedCount++;
                    checkPreviewComplete();
                }).catch(error => {
                    debugLog(`PDF预览生成失败: ${fileObj.name}, 错误: ${error.message}`);
                    itemDiv.innerHTML = `<div class="placeholder" style="display: flex; align-items: center; justify-content: center; height: 100%; background: #f5f5f5; border: none; color: #666;">无法预览: ${fileObj.name}</div>`;
                    processedCount++;
                    checkPreviewComplete();
                });
            } else if (fileObj.file && fileObj.file.type.startsWith('image/')) {
                // 处理图片文件
                const reader = new FileReader();
                reader.onload = function(e) {
                    fileObj.preview = e.target.result;
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.alt = fileObj.name;
                    img.style.cssText = 'width: 100%; height: 100%; object-fit: contain; border: none;';
                    itemDiv.appendChild(img);
                    processedCount++;
                    checkPreviewComplete();
                };
                reader.onerror = function() {
                    itemDiv.innerHTML = `<div class="placeholder" style="display: flex; align-items: center; justify-content: center; height: 100%; background: #f5f5f5; border: none; color: #666;">图片加载失败: ${fileObj.name}</div>`;
                    processedCount++;
                    checkPreviewComplete();
                };
                reader.readAsDataURL(fileObj.file);
            } else {
                // 其他情况显示占位符
                itemDiv.innerHTML = `<div class="placeholder" style="display: flex; align-items: center; justify-content: center; height: 100%; background: #f5f5f5; border: none; color: #666;">${fileObj.name}</div>`;
                processedCount++;
            }
            
            pageDiv.appendChild(itemDiv);
        }
        
        previewPagesElement.appendChild(pageDiv);
    }
    
    // 立即检查是否所有同步处理的文件都完成了
    checkPreviewComplete();
    
    // 检查预览是否完成
    function checkPreviewComplete() {
        debugLog(`预览进度: ${processedCount}/${totalFiles}`);
        if (processedCount >= totalFiles) {
            // 显示预览区域（因为这是用户主动点击预览按钮触发的）
            previewSection.style.display = 'block';
            hideProcessingStatus();
            debugLog('预览生成完成');
            
            // 添加预览页面的CSS样式
            addPreviewStyles();
        }
    }
}

// 获取A4页面样式 - 取消所有限制和框架
function getA4PageStyle(layout, orientation) {
    return {
        width: '100%',
        minHeight: 'auto',
        maxHeight: 'none',
        maxWidth: 'none',
        margin: '10px auto',
        padding: '10px',
        border: 'none',
        borderRadius: '0',
        backgroundColor: 'transparent',
        boxShadow: 'none',
        display: 'flex',
        flexWrap: layout === 'quad' ? 'wrap' : 'nowrap',
        flexDirection: layout === 'single' ? 'column' : (layout === 'double' ? 'column' : 'row'),
        alignItems: layout === 'single' ? 'center' : 'stretch',
        justifyContent: layout === 'single' ? 'flex-start' : 'space-between',
        gap: '5px'
    };
}

// 获取发票项样式 - 取消所有限制和框架
function getInvoiceItemStyle(layout, index, totalItems) {
    const baseStyle = {
        border: 'none',
        borderRadius: '0',
        backgroundColor: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
        padding: '5px'
    };
    
    switch (layout) {
        case 'single':
            return {
                ...baseStyle,
                width: '100%',
                height: 'auto',
                minHeight: 'auto',
                maxWidth: 'none',
                maxHeight: 'none',
                padding: '15px'
            };
        case 'double':
            return {
                ...baseStyle,
                width: '100%',
                height: 'auto',
                minHeight: 'auto',
                maxHeight: 'none',
                padding: '10px'
            };
        case 'quad':
            return {
                ...baseStyle,
                width: '48%',
                height: 'auto',
                minHeight: 'auto',
                maxHeight: 'none',
                padding: '5px'
            };
        default:
            return baseStyle;
    }
}

// 添加预览样式
function addPreviewStyles() {
    if (document.getElementById('previewStyles')) return;
    
    const style = document.createElement('style');
    style.id = 'previewStyles';
    style.textContent = `
        .preview-page {
            page-break-after: always;
            box-sizing: border-box;
        }
        
        .preview-page:last-child {
            page-break-after: avoid;
        }
        
        .preview-item img {
            transition: transform 0.2s ease;
        }
        
        .preview-item:hover img {
            transform: scale(1.02);
        }
        
        .placeholder {
            font-family: Arial, sans-serif;
            font-size: 14px;
            text-align: center;
        }
        
        @media (max-width: 768px) {
            .preview-page {
                max-width: 95vw;
                padding: 10px;
                min-height: 300px;
                max-height: 400px;
            }
            
            .preview-item {
                max-height: 150px;
            }
        }
        
        /* 预览图片样式 - 无边框无阴影 */
        .preview-item img {
            max-width: 100% !important;
            max-height: 100% !important;
            object-fit: contain !important;
            border: none !important;
            box-shadow: none !important;
        }
        
        /* 占位符样式 */
        .placeholder {
            border: none !important;
            box-shadow: none !important;
        }
    `;
    document.head.appendChild(style);
}

// 生成PDF指定页的预览 - 超高清晰度渲染
function generatePDFPagePreview(fileObj, pageNum) {
    return new Promise((resolve, reject) => {
        if (!fileObj.pdfDoc) {
            reject(new Error('PDF文档未加载'));
            return;
        }
        
        fileObj.pdfDoc.getPage(pageNum).then(function(page) {
            // 大幅提升缩放比例以获得超高清预览质量
            const scale = 3.0; // 提升到3倍缩放，显著提高清晰度
            const viewport = page.getViewport({scale: scale});
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            // 设置高DPI渲染
            const devicePixelRatio = window.devicePixelRatio || 1;
            const finalScale = scale * Math.max(devicePixelRatio, 2); // 确保至少2倍DPI
            
            // 重新计算viewport以获得最高质量
            const highQualityViewport = page.getViewport({scale: finalScale});
            
            // 设置canvas尺寸为高质量尺寸
            canvas.width = highQualityViewport.width;
            canvas.height = highQualityViewport.height;
            canvas.style.width = viewport.width + 'px';
            canvas.style.height = viewport.height + 'px';
            
            // 启用图像平滑和高质量渲染
            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = 'high';
            
            const renderContext = {
                canvasContext: context,
                viewport: highQualityViewport
            };
            
            page.render(renderContext).promise.then(function() {
                // 将canvas转换为最高质量的data URL
                const previewUrl = canvas.toDataURL('image/png', 1.0); // 100%质量
                debugLog(`PDF页面超高清预览生成成功: ${fileObj.name}, 页面${pageNum}, 缩放${finalScale}x`);
                resolve(previewUrl);
            }).catch(error => {
                debugLog(`PDF页面渲染失败: ${fileObj.name}, 页面${pageNum}, 错误: ${error.message}`);
                reject(error);
            });
        }).catch(error => {
            debugLog(`PDF页面获取失败: ${fileObj.name}, 页面${pageNum}, 错误: ${error.message}`);
            reject(error);
        });
    });
}

// 打印功能
function printInvoices() {
    if (uploadedFiles.length === 0) {
        alert('请先上传文件');
        return;
    }
    
    debugLog('开始打印发票');
    
    // 显示处理状态
    showProcessingStatus('正在准备打印文件...');
    
    // 先确保所有文件都有预览
    const filesWithPreview = [];
    const filesWithoutPreview = uploadedFiles.filter(file => !file.preview);
    
    if (filesWithoutPreview.length > 0) {
        // 为没有预览的文件生成预览
        let generatedCount = 0;
        
        filesWithoutPreview.forEach(fileObj => {
            if (fileObj.pdfDoc) {
                // 为PDF文件生成预览
                generatePDFPagePreview(fileObj, 1).then(previewUrl => {
                    fileObj.preview = previewUrl;
                    filesWithPreview.push(fileObj);
                    generatedCount++;
                    checkAllGenerated();
                }).catch(() => {
                    filesWithPreview.push(fileObj);
                    generatedCount++;
                    checkAllGenerated();
                });
            } else {
                // 对于其他文件，创建一个简单的占位符预览
                const canvas = document.createElement('canvas');
                canvas.width = 400;
                canvas.height = 200;
                const context = canvas.getContext('2d');
                context.fillStyle = '#f5f5f5';
                context.fillRect(0, 0, canvas.width, canvas.height);
                context.fillStyle = '#666';
                context.font = '16px Arial';
                context.textAlign = 'center';
                context.fillText(fileObj.name, canvas.width / 2, canvas.height / 2);
                
                fileObj.preview = canvas.toDataURL('image/png');
                filesWithPreview.push(fileObj);
                generatedCount++;
                checkAllGenerated();
            }
        });
        
        function checkAllGenerated() {
            if (generatedCount >= filesWithoutPreview.length) {
                proceedToPrint();
            }
        }
    } else {
        proceedToPrint();
    }
    
    function proceedToPrint() {
        try {
            // 智能确定布局和纸张方向 - 默认全部使用竖版
            let layout;
            let orientation = 'portrait'; // 默认竖版
            
            // 自动排版逻辑：
            if (uploadedFiles.length === 1) {
                layout = 'single';
                debugLog('1张发票：打印使用单页布局，A4竖版');
            } else if (uploadedFiles.length === 2) {
                layout = 'double';
                debugLog(`${uploadedFiles.length}张发票：打印使用双页布局，A4竖版，每页2张`);
            } else if (uploadedFiles.length >= 3 && uploadedFiles.length <= 4) {
                layout = 'double';
                debugLog(`${uploadedFiles.length}张发票：打印使用双页布局，A4竖版，每页2张`);
            } else if (uploadedFiles.length >= 5) {
                layout = 'quad';
                debugLog(`${uploadedFiles.length}张发票：打印使用四页布局，A4竖版，每页4张`);
            }
            
            debugLog(`最终打印布局: ${layout}, 方向: ${orientation}`);
            
            // 延迟确保所有预览都已生成完成
            setTimeout(() => {
                const printWindow = window.open('', '_blank');
                if (!printWindow) {
                    alert('无法打开打印窗口，请检查浏览器弹出窗口设置');
                    hideProcessingStatus();
                    return;
                }
                
                // 创建优化的打印内容
                const printContent = generatePrintContent(layout, orientation);
                
                // 写入打印窗口
                printWindow.document.open();
                printWindow.document.write(printContent);
                printWindow.document.close();
                
                // 等待内容加载完成后打印
                printWindow.onload = function() {
                    // 给图片加载一些时间
                    setTimeout(() => {
                        hideProcessingStatus();
                        printWindow.print();
                        
                        // 监听打印窗口的beforeunload事件，确保打印对话框关闭后再关闭窗口
                        printWindow.onbeforeunload = function() {
                            printWindow.close();
                        };
                        
                        // 安全备份：10秒后自动关闭窗口（防止beforeunload未触发）
                        setTimeout(() => {
                            if (!printWindow.closed) {
                                printWindow.close();
                            }
                        }, 10000);
                    }, 500);
                };
                
                debugLog('打印窗口已创建并配置完成');
            }, 1500);
        } catch (error) {
            console.error('打印过程中出错:', error);
            hideProcessingStatus();
            alert(`打印失败: ${error.message}`);
        }
    }
    
    // 生成优化的打印内容
    function generatePrintContent(layout, orientation) {
        const itemsPerPage = layout === 'single' ? 1 : layout === 'double' ? 2 : 4;
        let pagesContent = '';
        
        debugLog(`生成打印内容: ${uploadedFiles.length}个文件, 布局${layout}, 方向${orientation}, 每页${itemsPerPage}项`);
        
        for (let i = 0; i < uploadedFiles.length; i += itemsPerPage) {
            let pageItems = '';
            for (let j = 0; j < itemsPerPage && i + j < uploadedFiles.length; j++) {
                const fileObj = uploadedFiles[i + j];
                const previewSrc = fileObj.preview || getPlaceholderPreview(fileObj.name);
                
                // 根据布局确定项目样式类
                let itemClass = 'print-item';
                if (layout === 'single') {
                    itemClass += ' single-center';
                } else if (layout === 'double') {
                    itemClass += ' double-item';
                } else if (layout === 'quad') {
                    itemClass += ' quad-item';
                }
                
                pageItems += `<div class="${itemClass}">
                    <img src="${previewSrc}" alt="${fileObj.name}" loading="eager">
                </div>`;
            }
            
            pagesContent += `<div class="print-page layout-${layout} orientation-${orientation}">${pageItems}</div>`;
        }
        
        // 优化的打印样式，确保A4纸张适配
        const printStyles = `
            <style>
                * {
                    box-sizing: border-box;
                }
                
                @media print {
                    @page {
                        size: A4 ${orientation};
                        margin: 0;
                        padding: 0;
                    }
                    
                    body {
                        margin: 0;
                        padding: 0;
                        font-family: Arial, sans-serif;
                        background: white;
                        print-color-adjust: exact;
                        -webkit-print-color-adjust: exact;
                        color-adjust: exact;
                    }
                    
                    /* 全局高清晰度打印设置 */
                    * {
                        print-color-adjust: exact !important;
                        -webkit-print-color-adjust: exact !important;
                        color-adjust: exact !important;
                    }
                    
                    .print-page {
                        page-break-after: always;
                        width: 100%;
                        height: 297mm;
                        display: flex;
                        padding: 5mm;
                        margin: 0;
                        box-sizing: border-box;
                        ${layout === 'single' ? 
                            'flex-direction: column; align-items: center; justify-content: flex-start; padding-top: 10mm;' : 
                            layout === 'double' ? 
                                'flex-direction: column; justify-content: flex-start; align-items: center; gap: 5mm;' : 
                                'flex-wrap: wrap; align-content: flex-start; justify-content: space-around; gap: 3mm;'}
                    }
                    
                    .print-page:last-child {
                        page-break-after: avoid;
                    }
                    
                    /* 单张发票布局 - 置顶居中，高清晰度 */
                    .print-item.single-center {
                        width: 200mm;
                        height: 270mm;
                        max-width: 200mm;
                        max-height: 270mm;
                        display: flex;
                        align-items: flex-start;
                        justify-content: center;
                        box-sizing: border-box;
                        margin: 0 auto;
                        padding-top: 5mm;
                    }
                    
                    /* 双张发票布局 - 每页2张，置顶居中，高清晰度 */
                    .print-item.double-item {
                        width: 200mm;
                        height: 135mm;
                        max-width: 200mm;
                        max-height: 135mm;
                        display: flex;
                        align-items: flex-start;
                        justify-content: center;
                        box-sizing: border-box;
                        margin: 0 auto;
                        padding-top: 3mm;
                    }
                    
                    /* 四张发票布局 - 每页4张，2x2网格，置顶居中，高清晰度 */
                    .print-item.quad-item {
                        width: 97mm;
                        height: 135mm;
                        max-width: 97mm;
                        max-height: 135mm;
                        display: flex;
                        align-items: flex-start;
                        justify-content: center;
                        box-sizing: border-box;
                        margin: 0;
                        padding-top: 2mm;
                    }
                    
                    /* 关键：图片适配样式 - 高清晰度，置顶居中对齐 */
                    .print-item img {
                        width: 100% !important;
                        height: auto !important;
                        max-width: 100% !important;
                        max-height: 100% !important;
                        object-fit: contain !important;
                        object-position: center top !important;
                        display: block !important;
                        margin: 0 auto !important;
                        border: none !important;
                        padding: 0 !important;
                        box-sizing: border-box !important;
                        image-rendering: -webkit-optimize-contrast !important;
                        image-rendering: crisp-edges !important;
                        image-rendering: pixelated !important;
                        print-color-adjust: exact !important;
                        -webkit-print-color-adjust: exact !important;
                    }
                    
                    /* 确保发票完美适配纸张边界 */
                    .print-item {
                        overflow: hidden !important;
                        position: relative !important;
                        border: none !important;
                        background: transparent !important;
                    }
                }
                
                /* 屏幕预览样式 - 完全取消阴影底框，简洁显示 */
                @media screen {
                    body {
                        background: white;
                        padding: 10px;
                    }
                    
                    .print-page {
                        background: transparent;
                        box-shadow: none;
                        border: none;
                        margin-bottom: 15px;
                        border-radius: 0;
                        padding: 15px;
                        /* 保持A4竖版比例 */
                        width: 60vw;
                        height: calc(60vw * 1.414);
                        max-width: 595px;
                        max-height: 842px;
                        margin: 15px auto;
                        display: flex;
                        ${layout === 'single' ? 
                            'flex-direction: column; align-items: center; justify-content: flex-start; padding-top: 20px;' : 
                            layout === 'double' ? 
                                'flex-direction: column; justify-content: flex-start; gap: 10px;' : 
                                'flex-wrap: wrap; align-content: space-between; justify-content: space-between;'}
                    }
                    
                    .print-item {
                        border: none;
                        border-radius: 0;
                        background: transparent;
                        box-shadow: none;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        overflow: visible;
                    }
                    
                    .print-item.single-center {
                        width: 95%;
                        height: 95%;
                        max-width: 500px;
                        max-height: 700px;
                    }
                    
                    .print-item.double-item {
                        width: 95%;
                        height: calc(95% / 2 - 5px);
                        max-height: 340px;
                        margin: 2px 0;
                    }
                    
                    .print-item.quad-item {
                        width: calc(95% / 2 - 5px);
                        height: calc(95% / 2 - 5px);
                        max-height: 340px;
                        margin: 2px;
                    }
                    
                    .print-item img {
                        max-width: 100% !important;
                        max-height: 100% !important;
                        object-fit: contain !important;
                        object-position: center !important;
                    }
                }
            </style>
        `;
        
        const htmlContent = `
            <!DOCTYPE html>
            <html lang="zh-CN">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>打印发票 - ${uploadedFiles.length}张发票</title>
                ${printStyles}
            </head>
            <body>
                ${pagesContent}
                <script>
                    // 确保所有图片加载完成后再打印
                    window.addEventListener('load', function() {
                        const images = document.querySelectorAll('img');
                        let loadedCount = 0;
                        
                        if (images.length === 0) {
                            console.log('没有图片需要加载');
                            return;
                        }
                        
                        images.forEach(img => {
                            if (img.complete) {
                                loadedCount++;
                            } else {
                                img.onload = () => {
                                    loadedCount++;
                                    if (loadedCount === images.length) {
                                        console.log('所有图片加载完成');
                                    }
                                };
                                img.onerror = () => {
                                    loadedCount++;
                                    console.warn('图片加载失败:', img.src);
                                    if (loadedCount === images.length) {
                                        console.log('图片加载完成（部分失败）');
                                    }
                                };
                            }
                        });
                        
                        if (loadedCount === images.length) {
                            console.log('所有图片已加载完成');
                        }
                    });
                </script>
            </body>
            </html>
        `;
        
        debugLog('打印内容生成完成');
        return htmlContent;
    }
    
    // 获取占位符预览
    function getPlaceholderPreview(filename) {
        // 创建一个简单的占位符SVG图像
        const svg = `data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='200' viewBox='0 0 300 200'%3E%3Crect width='300' height='200' fill='%23f0f0f0'/%3E%3Ctext x='150' y='100' font-family='Arial' font-size='12' text-anchor='middle' fill='%23666'%3E${encodeURIComponent(filename)}%3C/text%3E%3C/svg%3E`;
        return svg;
    }
}

// 初始化函数
function initializeApp() {
    debugLog('开始初始化应用');
    
    // 获取DOM元素
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.querySelector('.upload-btn');
    const clearBtn = document.getElementById('clearBtn');
    const previewBtn = document.getElementById('previewBtn');
    const printBtn = document.getElementById('printBtn');
    
    debugLog(`DOM元素检查: 
        uploadArea: ${!!uploadArea}
        fileInput: ${!!fileInput}
        uploadBtn: ${!!uploadBtn}
        clearBtn: ${!!clearBtn}
        previewBtn: ${!!previewBtn}
        printBtn: ${!!printBtn}`);
    
    // 文件输入事件
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            debugLog('文件输入change事件触发');
            if (e.target.files && e.target.files.length > 0) {
                processFiles(e.target.files);
            }
        });
        debugLog('文件输入事件已绑定');
    }
    
    // 上传按钮点击事件
    if (uploadBtn) {
        uploadBtn.addEventListener('click', function(e) {
            e.preventDefault();
            debugLog('上传按钮被点击');
            if (fileInput) {
                fileInput.click();
            }
        });
        debugLog('上传按钮事件已绑定');
    }
    
    // 拖拽事件
    if (uploadArea) {
        uploadArea.addEventListener('dragover', function(e) {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', function(e) {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', function(e) {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            debugLog('拖拽文件事件触发');
            
            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                processFiles(files);
            }
        });
        debugLog('拖拽事件已绑定');
    }
    
    // 其他按钮事件
    if (clearBtn) {
        clearBtn.addEventListener('click', clearAllFiles);
        debugLog('清空按钮事件已绑定');
    }
    
    if (previewBtn) {
        previewBtn.addEventListener('click', generatePreview);
        debugLog('预览按钮事件已绑定');
    }
    
    if (printBtn) {
        printBtn.addEventListener('click', printInvoices);
        debugLog('打印按钮事件已绑定');
    }
    
    // 自动排版模式 - 已移除用户选择控件
    debugLog('使用自动排版模式：1张发票单页居中，2张及以上发票每页2张，A4竖版');
    
    debugLog('应用初始化完成');
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// 全局错误处理
window.addEventListener('error', function(e) {
    debugLog(`全局错误: ${e.message}`);
    console.error('全局错误:', e);
});

// 设置PDF.js工作路径 - 使用本地版本
if (typeof pdfjsLib !== 'undefined') {
    // 优先使用本地PDF.js worker
    if (typeof window.pdfjsWorker !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/pdf.worker.min.js';
        debugLog('使用本地PDF.js worker');
    } else {
        // 回退到CDN
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        debugLog('使用CDN PDF.js worker');
    }
}

// 浏览器兼容性处理
if (!window.showOpenFilePicker) {
    debugLog('showOpenFilePicker API不可用，使用传统文件选择器');
    // 传统文件选择器已在代码中使用
}