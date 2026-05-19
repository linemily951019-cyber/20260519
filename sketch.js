let video;
let bgImg; // 春日野餐像素風背景圖
let generatedPixelBg; // 程式碼自動生成的像素風背景
let handPose;         // ml5 手部辨識器
let hands = [];       // 儲存手部偵測結果
let modelStatus = ""; // 儲存模型狀態的文字
let isWebGLSupported = true; // 紀錄是否支援 WebGL

// --- 遊戲全域變數 ---
const STATE_WAITING = 0;  // 等待玩家出拳
const STATE_THINKING = 1; // AI 思考中
const STATE_RESULT = 2;   // 顯示勝負結果
const STATE_REPLAY_ASK = 3; // 詢問是否再玩一局
const STATE_GAME_OVER = 4;  // 遊戲結束畫面

let gameState = STATE_WAITING;
let playerProgress = 0;   // 玩家辨識進度 (0-100)
let aiProgress = 0;       // AI 思考進度 (0-100)
let actionProgress = 0;   // 詢問介面手勢確認進度 (0-100)
let playerChoice = "";    // 玩家出拳結果
let aiChoice = "";        // AI 出拳結果
let currentAction = "";   // 目前偵測到的動作 ("continue" 或 "end")
let gameResult = "";      // 勝負文字
let resultTimer = 0;      // 記錄進入結果畫面的時間
let aiChoices = ["剪刀", "石頭", "布"];
let wins = 0;             // 玩家勝場數
let ties = 0;             // 平手數
let losses = 0;           // 玩家敗場數
let confettis = [];       // 儲存彩帶粒子的陣列

function preload() {
  // 如果您有準備好的像素風背景圖，請將註解取消並替換為正確的檔案路徑
  // bgImg = loadImage('spring_picnic_pixel.png');
}

function setup() {
  // 第一步驟：產生一個全螢幕的畫布
  createCanvas(windowWidth, windowHeight);

  // 啟動攝影機
  video = createCapture(VIDEO);
  video.hide(); // 隱藏原本的 HTML 影片元素，因為我們會在畫布上繪製它

  // 檢查裝置是否支援 WebGL (ml5.js/TensorFlow.js 依賴硬體加速)
  let cvs = document.createElement('canvas');
  let gl = cvs.getContext('webgl') || cvs.getContext('experimental-webgl');
  isWebGLSupported = !!(window.WebGLRenderingContext && gl);

  if (!isWebGLSupported) {
    modelStatus = "⚠️ 您的裝置不支援 WebGL，AI 模型可能無法正常執行！";
  } else {
    modelStatus = "⏳ AI 模型載入中...";
    // 初始化 ml5 手部辨識模型 (HandPose)
    handPose = ml5.handPose(video, modelReady);
  }

  // 初始化生成內建的春日像素風背景
  generatedPixelBg = createPixelArtBackground();
}

// 模型載入完成的 Callback 函數
function modelReady() {
  modelStatus = "✅ AI 模型載入成功！";
  // 3 秒後自動清除狀態文字
  setTimeout(() => {
    modelStatus = "";
  }, 3000);
  // 開始連續偵測手部
  handPose.detectStart(video, gotHands);
}

function gotHands(results) {
  hands = results;
}

function draw() {
  // 判斷是否處於玩家失敗的狀態
  let isLosing = (gameState === STATE_RESULT && gameResult.startsWith("AI的"));
  let shakeIntensity = 0;
  let redOpacity = 0;

  if (isLosing) {
    let timeSinceResult = millis() - resultTimer;
    // 震動效果只在剛輸掉的 0.5 秒內，並逐漸減弱
    if (timeSinceResult < 500) {
      shakeIntensity = map(timeSinceResult, 0, 500, 12, 0, true);
    }
    // 紅色遮罩的透明度在 3 秒內逐漸消退
    redOpacity = map(timeSinceResult, 0, 3000, 80, 0, true);
  }

  push();
  if (shakeIntensity > 0) {
    // 畫面震動效果 (隨機偏移原點)
    translate(random(-shakeIntensity, shakeIntensity), random(-shakeIntensity, shakeIntensity));
  }

  // 繪製春日野餐的像素風背景
  if (bgImg) {
    // 稍微放大一點點避免震動時露出畫布黑邊
    image(bgImg, -15, -15, width + 30, height + 30);
  } else {
    // 如果沒有圖片，則使用程式碼繪製草地與野餐墊模擬氛圍
    drawFallbackBackground();
  }

  // 擷取的影像產生在畫布的中間，顯示的影像寬高為整個畫布寬高的 50%
  let videoW = width * 0.5;
  let videoH = height * 0.5;

  push();
  // 將原點移至畫布正中心
  translate(width / 2, height / 2);
  // 畫面左右顛倒處理 (水平翻轉)
  scale(-1, 1);
  
  // 將攝影機影像畫在中心點
  imageMode(CENTER);
  image(video, 0, 0, videoW, videoH);

  // ---------- 繪製手部骨架與節點 ----------
  if (hands && hands.length > 0) {
    // 改為用迴圈支援多隻手同時偵測與個別顏色區分
    for (let h = 0; h < hands.length; h++) {
      let hand = hands[h];

      // 依據手勢判斷左右手來決定線條顏色 (考慮到畫面有做 scale(-1, 1) 的鏡像翻轉)
      if (hand.handedness === "Left") {
        stroke(0, 255, 0);   // 左手為綠色
      } else {
        stroke(255, 255, 0); // 右手為黃色
      }
      
      strokeWeight(4); // 恢復原本的粗細

      let lines = [
        [0, 1, 2, 3, 4],     // 拇指
        [5, 6, 7, 8],        // 食指
        [9, 10, 11, 12],     // 中指
        [13, 14, 15, 16],    // 無名指
        [17, 18, 19, 20]     // 小指
      ];
      for (let linePoints of lines) {
        beginShape();
        noFill();
        for (let i of linePoints) {
          let kp = hand.keypoints[i];
          let x = map(kp.x, 0, video.width, -videoW / 2, videoW / 2);
          let y = map(kp.y, 0, video.height, -videoH / 2, videoH / 2);
          vertex(x, y);
        }
        endShape();
      }
      
      // 繪製關節點 (保持紅色)
      fill(255, 0, 0);
      noStroke();
      for (let i = 0; i < hand.keypoints.length; i++) {
        let kp = hand.keypoints[i];
        let x = map(kp.x, 0, video.width, -videoW / 2, videoW / 2);
        let y = map(kp.y, 0, video.height, -videoH / 2, videoH / 2);
        circle(x, y, 8);
      }
    }
  }
  pop();

  // 如果玩家失敗，在背景和影像上疊加一層紅色半透明遮罩
  if (redOpacity > 0) {
    fill(255, 0, 0, redOpacity); // 帶有透明度變化的紅色
    noStroke();
    rect(-15, -15, width + 30, height + 30);
  }
  
  pop(); // 結束震動與遮罩的作用範圍

  // 顯示 WebGL 狀態與 AI 模型載入訊息 (顯示在擷取畫面的前方)
  push();
  fill(255); // 白色字體
  stroke(0); // 黑色邊框，確保在任何背景下都能看清楚
  strokeWeight(4);
  textSize(max(16, width * 0.02)); // 根據螢幕寬度自動調整字體大小，最小 16px
  textAlign(CENTER, CENTER); // 將對齊點改為正中央
  // 將文字畫在畫面正中間
  text(modelStatus, width / 2, height / 2);
  pop();

  // --- 遊戲邏輯與狀態機 ---
  if (gameState === STATE_WAITING) {
    let currentGesture = null;
    if (hands && hands.length > 0) {
      currentGesture = detectGesture(hands[0]);
    }
    
    if (currentGesture) {
      if (playerChoice !== currentGesture) {
        // 玩家變換手勢，重置進度並更新當前選擇
        playerChoice = currentGesture;
        playerProgress = 0;
      }
      // 偵測到有效手勢，累積進度條 (約 2 秒滿)
      playerProgress += (deltaTime / 2000) * 100;
      if (playerProgress >= 100) {
        playerProgress = 100;
        gameState = STATE_THINKING; // 進入 AI 思考階段
        aiChoice = random(aiChoices); // AI 隨機決定出拳
        aiProgress = 0;
      }
    } else {
      // 手部離開或手勢不穩定，進度重設
      playerProgress = 0;
      playerChoice = "";
    }
  } else if (gameState === STATE_THINKING) {
    // AI 思考進度條 (約 1.5 秒滿)
    aiProgress += (deltaTime / 1500) * 100;
    if (aiProgress >= 100) {
      aiProgress = 100;
      gameState = STATE_RESULT;
      determineWinner(); // 判定勝負
      resultTimer = millis(); // 紀錄結果畫面開始時間
      
      // 如果玩家獲勝，產生大量的彩帶特效
      if (gameResult.startsWith("你的")) {
        confettis = [];
        for (let i = 0; i < 150; i++) { // 產生 150 片彩帶
          confettis.push(new Confetti());
        }
      }
    }
  } else if (gameState === STATE_RESULT) {
    // 顯示結果 3 秒後自動進入詢問是否繼續的畫面
    if (millis() - resultTimer > 3000) {
      gameState = STATE_REPLAY_ASK;
      actionProgress = 0;
      currentAction = "";
      confettis = []; // 清空彩帶
    }
  } else if (gameState === STATE_REPLAY_ASK) {
    // --- 偵測手勢以決定「繼續」或「結束」 ---
    let detectedAction = null;
    if (hands && hands.length > 0) {
      detectedAction = detectActionGesture(hands[0]);
    }
    
    if (detectedAction) {
      if (currentAction !== detectedAction) {
        currentAction = detectedAction;
        actionProgress = 0; // 如果手勢改變，重設防抖動進度條
      }
      // 防抖動與累計進度：持續穩定 1.5 秒 (1500 毫秒) 達到 100%
      actionProgress += (deltaTime / 1500) * 100;
      if (actionProgress >= 100) {
        executeAction(currentAction);
      }
    } else {
      // 未偵測到特定手勢或手勢離開，重設進度
      actionProgress = 0;
      currentAction = "";
    }
  }

  // 繪製遊戲 UI
  drawGameUI();
}

function windowResized() {
  // 當視窗大小改變時，自動重新調整畫布大小維持全螢幕
  resizeCanvas(windowWidth, windowHeight);
  // 重新生成符合新比例的像素背景
  generatedPixelBg = createPixelArtBackground();
}

// 將生成的像素圖繪製到畫面上
function drawFallbackBackground() {
  noSmooth(); // 關閉平滑處理，放大時保持邊緣銳利的像素顆粒感
  imageMode(CORNER);
  // 稍微放大一點以防震動時露出畫布邊緣
  image(generatedPixelBg, -15, -15, width + 30, height + 30);
}

// --- 判斷玩家手勢邏輯 ---
function detectGesture(hand) {
  let wrist = hand.keypoints[0];
  
  // 透過指尖 (Tip) 到手腕的距離，是否大於掌根 (MCP) 到手腕的距離乘上係數，來判斷手指是否伸直
  let isIndexExt = dist(wrist.x, wrist.y, hand.keypoints[8].x, hand.keypoints[8].y) > dist(wrist.x, wrist.y, hand.keypoints[5].x, hand.keypoints[5].y) * 1.3;
  let isMiddleExt = dist(wrist.x, wrist.y, hand.keypoints[12].x, hand.keypoints[12].y) > dist(wrist.x, wrist.y, hand.keypoints[9].x, hand.keypoints[9].y) * 1.3;
  let isRingExt = dist(wrist.x, wrist.y, hand.keypoints[16].x, hand.keypoints[16].y) > dist(wrist.x, wrist.y, hand.keypoints[13].x, hand.keypoints[13].y) * 1.3;
  let isPinkyExt = dist(wrist.x, wrist.y, hand.keypoints[20].x, hand.keypoints[20].y) > dist(wrist.x, wrist.y, hand.keypoints[17].x, hand.keypoints[17].y) * 1.3;

  let extCount = isIndexExt + isMiddleExt + isRingExt + isPinkyExt;

  if (extCount >= 3) return "布"; 
  if (extCount === 0) return "石頭"; 
  if (isIndexExt && isMiddleExt && !isRingExt && !isPinkyExt) return "剪刀"; 
  
  return null;
}

// --- 勝負判定邏輯 ---
function determineWinner() {
  if (playerChoice === aiChoice) {
    gameResult = `你和AI都出了${playerChoice}，平手！`;
    ties++;
  } else if (
    (playerChoice === "剪刀" && aiChoice === "布") ||
    (playerChoice === "石頭" && aiChoice === "剪刀") ||
    (playerChoice === "布" && aiChoice === "石頭")
  ) {
    gameResult = `你的${playerChoice}打敗了AI的${aiChoice}！`;
    wins++;
  } else {
    gameResult = `AI的${aiChoice}打敗了你的${playerChoice}！`;
    losses++;
  }
}

// --- 判斷「繼續」或「結束」的手勢邏輯 ---
function detectActionGesture(hand) {
  let wrist = hand.keypoints[0];
  // 取得各指尖與指根(MCP)
  let thumbTip = hand.keypoints[4];
  let thumbMcp = hand.keypoints[2];
  let indexTip = hand.keypoints[8];
  let indexMcp = hand.keypoints[5];
  let middleTip = hand.keypoints[12];
  let middleMcp = hand.keypoints[9];
  let ringTip = hand.keypoints[16];
  let ringMcp = hand.keypoints[13];
  let pinkyTip = hand.keypoints[20];
  let pinkyMcp = hand.keypoints[17];

  // 判斷各手指是否伸直 (Tip 到 Wrist 的距離大於 MCP 到 Wrist 的距離乘上比例)
  let isThumbExt = dist(wrist.x, wrist.y, thumbTip.x, thumbTip.y) > dist(wrist.x, wrist.y, thumbMcp.x, thumbMcp.y) * 1.2;
  let isIndexExt = dist(wrist.x, wrist.y, indexTip.x, indexTip.y) > dist(wrist.x, wrist.y, indexMcp.x, indexMcp.y) * 1.3;
  let isMiddleExt = dist(wrist.x, wrist.y, middleTip.x, middleTip.y) > dist(wrist.x, wrist.y, middleMcp.x, middleMcp.y) * 1.3;
  // 修改點：修正原本錯亂重複的數學公式，讓無名指可以被精準偵測
  let isRingExt = dist(wrist.x, wrist.y, ringTip.x, ringTip.y) > dist(wrist.x, wrist.y, ringMcp.x, ringMcp.y) * 1.3;
  let isPinkyExt = dist(wrist.x, wrist.y, pinkyTip.x, pinkyTip.y) > dist(wrist.x, wrist.y, pinkyMcp.x, pinkyMcp.y) * 1.3;

  // 判斷 OK 手勢 👌：大拇指尖和食指尖距離小，且其餘三根手指伸直
  let pinchDist = dist(thumbTip.x, thumbTip.y, indexTip.x, indexTip.y);
  let handSize = dist(wrist.x, wrist.y, indexMcp.x, indexMcp.y); // 作為比例尺
  let isPinching = pinchDist < handSize * 0.8;

  if (isPinching && isMiddleExt && isRingExt && isPinkyExt) {
    return "continue";
  }

  // 判斷 I Love You / 搖滾手勢 🤟：大拇指、食指、小指伸直，中指與無名指彎曲
  if (isThumbExt && isIndexExt && !isMiddleExt && !isRingExt && isPinkyExt) {
    return "end";
  }

  return null;
}

// --- 執行「繼續」或「結束」動作 ---
function executeAction(action) {
  if (action === "continue") {
    // 開啟新的一局（保留戰績）
    gameState = STATE_WAITING;
    playerProgress = 0;
    aiProgress = 0;
    playerChoice = "";
    aiChoice = "";
    gameResult = "";
    actionProgress = 0;
    currentAction = "";
  } else if (action === "end") {
    // 進入遊戲結束畫面
    gameState = STATE_GAME_OVER;
    actionProgress = 0;
    currentAction = "";
  }
}

// --- 取得對應的手勢圖示 ---
function getIcon(choice) {
  if (choice === "剪刀") return "✌️";
  if (choice === "石頭") return "✊";
  if (choice === "布") return "🖐️";
  return "❓";
}

// --- 繪製遊戲畫面與進度條 ---
function drawGameUI() {
  push();
  textAlign(CENTER, CENTER);
  
  let barWidth = width * 0.4;
  let barHeight = 20;
  let px = width / 2 - barWidth / 2;
  let videoW = width * 0.5;
  let videoH = height * 0.5;
  
  // 只有在等待出拳階段，才繪製提示文字與出拳進度條
  if (gameState === STATE_WAITING) {
    let instructionTextSize = max(15, width * 0.015); 
    fill(255);
    stroke(0);
    strokeWeight(3);
    textSize(instructionTextSize);
    
    // 擷取畫面下邊界的 Y 軸座標位置
    let videoBottomY = height / 2 + videoH / 2;
    
    // 將第一行往上微調至下邊界下方固定 25 像素，確保不進入影像，同時騰出下方空間
    let textY = videoBottomY + 25;
    text("請將手伸入畫面", width / 2, textY);
    text("比出剪刀✌️、石頭✊、布🖐️", width / 2, textY + instructionTextSize * 1.5);

    // 1. 玩家出拳進度條 (配合文字上移一併優化排版)
    let py = textY + instructionTextSize * 3.8;
    fill(0, 150);
    noStroke();
    rect(px, py, barWidth, barHeight, 10);
    fill(0, 255, 0);
    rect(px, py, barWidth * (playerProgress / 100), barHeight, 10);
    
    fill(255);
    stroke(0);
    strokeWeight(3);
    let progressTextSize = max(15, width * 0.015);
    textSize(progressTextSize);
    text(`玩家出拳鎖定進度：${Math.floor(playerProgress)}%`, width / 2, py - progressTextSize * 1.1);
    
    // 若正在等待且有抓到手勢，顯示即時預覽
    if (playerChoice) {
      fill(255, 255, 0);
      text(`當前偵測：${playerChoice}`, width / 2, py + barHeight + progressTextSize * 1.3);
    }
  }

  // 2. AI 思考進度條 (畫面上方)
  if (gameState === STATE_THINKING) {
    let apy = height * 0.25 - max(40, height * 0.05);
    fill(0, 150);
    noStroke();
    rect(px, apy, barWidth, barHeight, 10);
    fill(255, 100, 0);
    rect(px, apy, barWidth * (aiProgress / 100), barHeight, 10);
    
    fill(255);
    stroke(0);
    strokeWeight(3);
    textSize(max(18, width * 0.02));
    let thinkingIcon = getIcon(aiChoices[Math.floor(millis() / 100) % 3]);
    text(`AI 思考中... ${thinkingIcon} ${Math.floor(aiProgress)}%`, width / 2, apy - 20);
  }

  // 3. 結果顯示框
  if (gameState === STATE_RESULT) {
    let iconSize = max(50, width * 0.04);
    let roleSize = max(20, width * 0.018);
    let resultSize = max(26, width * 0.025);
    
    let boxW = videoW;
    let boxH = videoH;
    let bx = width / 2 - boxW / 2;
    let by = height / 2 - boxH / 2;
    
    fill(0, 200);
    noStroke();
    rect(bx, by, boxW, boxH, 0); 
    
    stroke(0);
    strokeWeight(4);
    
    let curY = by + boxH * 0.25;
    textSize(iconSize);
    text(`${getIcon(playerChoice)}    VS    ${getIcon(aiChoice)}`, width / 2, curY);

    curY += boxH * 0.22;
    textSize(roleSize);
    fill(255, 255, 0);
    text(`玩家：${playerChoice}              AI：${aiChoice}`, width / 2, curY);
    
    curY += boxH * 0.25;
    textSize(resultSize); 
    if (gameResult.startsWith("你的")) fill(50, 255, 50);
    else if (gameResult.startsWith("AI的")) fill(255, 50, 50);
    else fill(200, 200, 200);
    text(gameResult, width / 2, curY);
    
    if (gameResult.startsWith("你的")) {
      for (let i = 0; i < confettis.length; i++) {
        confettis[i].update();
        confettis[i].display();
      }
    }
  }
  
  // 5. 詢問是否繼續畫面
  if (gameState === STATE_REPLAY_ASK) {
    let titleSize = max(28, width * 0.028);
    let hintSize = max(15, width * 0.015);
    let btnH = max(50, height * 0.06);
    
    let boxW = videoW;
    let boxH = videoH;
    let bx = width / 2 - boxW / 2;
    let by = height / 2 - boxH / 2;
    
    fill(0, 150);
    noStroke();
    rect(bx, by, boxW, boxH, 0); 
    
    fill(255);
    textSize(titleSize);
    text("要再玩一局嗎？", width / 2, by + boxH * 0.25);
    
    let btnW = boxW * 0.35;
    let btnY = by + boxH * 0.42;
    let continueX = width / 2 - btnW - 20;
    let endX = width / 2 + 20;
    
    strokeWeight(4);
    stroke(0, 200, 255); 
    if (currentAction === "continue") fill(0, 200, 255, 100);
    else noFill();
    rect(continueX, btnY, btnW, btnH, 15);
    
    if (currentAction === "continue" && actionProgress > 0) {
      noStroke();
      fill(0, 255, 0, 150);
      rect(continueX, btnY, btnW * (actionProgress / 100), btnH, 15);
    }
    
    noStroke();
    fill(255);
    textSize(max(20, width * 0.02));
    text("繼續", continueX + btnW / 2, btnY + btnH / 2 + 2);
    
    strokeWeight(4);
    stroke(255, 100, 50); 
    if (currentAction === "end") fill(255, 100, 50, 100);
    else noFill();
    rect(endX, btnY, btnW, btnH, 15);
    
    if (currentAction === "end" && actionProgress > 0) {
      noStroke();
      fill(255, 0, 0, 150);
      rect(endX, btnY, btnW * (actionProgress / 100), btnH, 15);
    }
    
    noStroke();
    fill(255);
    text("結束", endX + btnW / 2, btnY + btnH / 2 + 2);
    
    textSize(hintSize);
    fill(200);
    text("比 OK 👌 → 繼續  、  比 🤟 → 結束", width / 2, btnY + btnH + boxH * 0.12);
  }

  // 6. 遊戲結束畫面 (STATE_GAME_OVER)
  if (gameState === STATE_GAME_OVER) {
    let totalGames = wins + losses + ties;
    let winRate = totalGames > 0 ? ((wins / totalGames) * 100).toFixed(1) : "0.0";
    
    let titleSize = max(40, width * 0.04);
    let subTitleSize = max(28, width * 0.03);
    let statSize = max(22, width * 0.022);
    let btnH = max(60, height * 0.08);
    let lineHeight = statSize * 1.8;

    let boxH = titleSize + subTitleSize + (lineHeight * 5) + btnH + 150;
    let boxW = max(600, width * 0.6);
    let bx = width / 2 - boxW / 2;
    let by = height / 2 - boxH / 2;

    fill(0, 150);
    noStroke();
    rect(bx, by, boxW, boxH, 20);

    let curY = by + titleSize * 1.5;
    fill(255);
    textSize(titleSize);
    text("遊戲結束，感謝遊玩！", width / 2, curY);

    curY += subTitleSize * 2;
    textSize(subTitleSize);
    fill(255, 255, 0);
    text("✨ 最終總結算 ✨", width / 2, curY);

    curY += statSize * 2;
    textAlign(CENTER, TOP);
    textSize(statSize);
    fill(255);
    text(`總局數：${totalGames} 局`, width / 2, curY);
    text(`🏆 勝場：${wins} 次`, width / 2, curY + lineHeight * 1);
    text(`❌ 敗場：${losses} 次`, width / 2, curY + lineHeight * 2);
    text(`🤝 平手：${ties} 次`, width / 2, curY + lineHeight * 3);
    text(`勝率：${winRate} %`, width / 2, curY + lineHeight * 4);

    let btnW = boxW * 0.4;
    let btnX = width / 2 - btnW / 2;
    let btnY = by + boxH - btnH - 30;
    strokeWeight(4);
    stroke(100, 255, 100);
    noFill();
    rect(btnX, btnY, btnW, btnH, 15);
    noStroke();
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(max(24, width * 0.025));
    text("重新開始", width / 2, btnY + btnH / 2);
  }

  // 4. 在擷取畫面的頂部中央顯示勝敗統計
  if (gameState !== STATE_GAME_OVER) {
    let videoTop = height * 0.25;
    let scoreTextSize = max(18, width * 0.015);
    
    textSize(scoreTextSize);
    stroke(0);
    strokeWeight(3);
    
    let strLoss = `❌ ${losses}敗`;
    let strTie = `🤝 ${ties}平`;
    let strWin = `✅ ${wins}勝`;

    let winW = textWidth(strWin);
    let tieW = textWidth(strTie);
    let lossW = textWidth(strLoss);
    let spacing = 20;
    let totalW = winW + spacing + tieW + spacing + lossW;
    let startX = width / 2 - totalW / 2;

    textAlign(LEFT, TOP);

    fill(50, 255, 50); 
    text(strWin, startX, videoTop + 15);
    
    fill(255, 165, 0); 
    text(strTie, startX + winW + spacing, videoTop + 15);
    
    fill(255, 50, 50);  
    text(strLoss, startX + winW + spacing + tieW + spacing, videoTop + 15);
  }

  pop();
}

// 使用低解析度畫布生成真正的像素畫 (Pixel Art)
function createPixelArtBackground() {
  let resW = 200;
  let resH = Math.max(Math.floor(200 * (windowHeight / windowWidth)), 120);
  let pg = createGraphics(resW, resH);
  pg.noSmooth(); 
  pg.noStroke();

  // 天空
  for (let y = 0; y < resH * 0.5; y++) {
    let inter = map(y, 0, resH * 0.5, 0, 1);
    let c = lerpColor(color(120, 190, 255), color(210, 240, 255), inter);
    pg.stroke(c);
    pg.line(0, y, resW, y);
  }
  pg.noStroke();

  // 太陽
  pg.fill(255, 240, 100);
  pg.circle(resW * 0.85, resH * 0.15, 18);

  // 雲朵
  drawCloud(pg, resW * 0.2, resH * 0.15, 30);
  drawCloud(pg, resW * 0.6, resH * 0.25, 20);
  drawCloud(pg, resW * 0.8, resH * 0.1, 25);

  // 遠山
  pg.fill(130, 190, 160);
  pg.triangle(resW * 0.05, resH * 0.5, resW * 0.35, resH * 0.25, resW * 0.65, resH * 0.5);
  pg.fill(110, 70, 140);
  pg.triangle(resW * 0.35, resH * 0.5, resW * 0.7, resH * 0.2, resW * 1.05, resH * 0.5);

  // 像素風櫻花樹
  drawSakuraTree(pg, resW * 0.15, resH * 0.45, 18, 30);
  drawSakuraTree(pg, resW * 0.85, resH * 0.48, 24, 35);

  // 草地
  for (let y = Math.floor(resH * 0.5); y <= resH; y++) {
    let inter = map(y, resH * 0.5, resH, 0, 1);
    let c = lerpColor(color(140, 210, 120), color(100, 180, 80), inter);
    pg.stroke(c);
    pg.line(0, y, resW, y);
  }
  pg.noStroke();

  // 散落的櫻花瓣與深色草地紋理
  for (let i = 0; i < 150; i++) {
    let x = random(resW);
    let y = random(resH * 0.5, resH);
    pg.fill(80, 160, 60, 150); 
    pg.rect(x, y, 1, 2);
    if (random() > 0.7) {
      pg.fill(random(['#FFB7C5', '#FFF0F5', '#FFFFFF'])); 
      pg.rect(x + random(-2, 2), y, random(1, 3), 1);
    }
  }

  return pg;
}

function drawCloud(pg, cx, cy, w) {
  pg.fill(255);
  pg.circle(cx, cy, w * 0.6);
  pg.circle(cx - w * 0.3, cy + w * 0.1, w * 0.5);
  pg.circle(cx + w * 0.3, cy + w * 0.1, w * 0.5);
  pg.rect(cx - w * 0.5, cy, w, w * 0.3); 
  
  pg.fill(220, 230, 240);
  pg.rect(cx - w * 0.4, cy + w * 0.2, w * 0.8, w * 0.1);
}

function drawSakuraTree(pg, x, y, tw, th) {
  pg.fill(110, 70, 50);
  pg.rect(x - tw * 0.15, y, tw * 0.3, th);
  
  pg.fill(255, 160, 190);
  pg.circle(x, y, tw * 1.8);
  pg.circle(x - tw * 0.5, y + th * 0.2, tw * 1.5);
  pg.circle(x + tw * 0.5, y + th * 0.2, tw * 1.5);
  
  pg.fill(255, 200, 220);
  pg.circle(x, y - tw * 0.2, tw * 1.4);
  pg.circle(x - tw * 0.4, y + th * 0.1, tw * 1.0);
}

// --- 彩帶粒子類別 ---
class Confetti {
  constructor() {
    this.x = width / 2;
    this.y = height / 2 + 50; 
    this.w = random(8, 15);
    this.h = random(8, 15);
    this.vx = random(-12, 12);  
    this.vy = random(-18, -8);  
    this.color = color(random(['#ff718d', '#fdff6a', '#a6e5ff', '#71ff98'])); 
    this.angle = random(TWO_PI);
    this.spin = random(-0.2, 0.2); 
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.5;     
    this.vx *= 0.98;    
    this.angle += this.spin;
  }
  display() {
    push();
    translate(this.x, this.y);
    rotate(this.angle);
    noStroke();
    fill(this.color);
    rectMode(CENTER);
    rect(0, 0, this.w, this.h);
    pop();
  }
}

function mousePressed() {
  let videoW = width * 0.5;
  let videoH = height * 0.5;
  
  if (gameState === STATE_REPLAY_ASK) {
    let boxW = videoW;
    let boxH = videoH;
    let by = height / 2 - boxH / 2;
    let btnW = boxW * 0.35;
    let btnY = by + boxH * 0.42;
    let btnH = max(50, height * 0.06);
    let continueX = width / 2 - btnW - 20;
    let endX = width / 2 + 20;
    
    if (mouseX >= continueX && mouseX <= continueX + btnW && mouseY >= btnY && mouseY <= btnY + btnH) {
      executeAction("continue");
    } else if (mouseX >= endX && mouseX <= endX + btnW && mouseY >= btnY && mouseY <= btnY + btnH) {
      executeAction("end");
    }
  } else if (gameState === STATE_GAME_OVER) {
    let titleSize = max(40, width * 0.04);
    let subTitleSize = max(28, width * 0.03);
    let statSize = max(22, width * 0.022);
    let btnH = max(60, height * 0.08);
    let lineHeight = statSize * 1.8;
    let boxH = titleSize + subTitleSize + (lineHeight * 5) + btnH + 150;
    let boxW = max(600, width * 0.6);
    let by = height / 2 - boxH / 2;
    let btnW = boxW * 0.4;
    let btnX = width / 2 - btnW / 2;
    let btnY = by + boxH - btnH - 30;

    if (mouseX >= btnX && mouseX <= btnX + btnW && mouseY >= btnY && mouseY <= btnY + btnH) {
      resetGame();
    }
  }
}

function resetGame() {
  gameState = STATE_WAITING;
  playerProgress = 0;
  aiProgress = 0;
  actionProgress = 0;
  playerChoice = "";
  aiChoice = "";
  currentAction = "";
  gameResult = "";
  confettis = [];
  wins = 0;
  losses = 0;
  ties = 0;
}
