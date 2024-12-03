var map = new AMap.Map('container', {
    resizeEnable: true,
    center: [113.324361,23.10841],
    zoom: 13,
    mapStyle: 'amap://styles/fresh',
    isHotspot: true
});
const accessToken = 'pat_9zPxd6hYyOLpEENunjVgdyhU2ZDWBHM5Jt5R16yuEF1c1VwoMK82Bt9j6yEg6k9R';
const botId = '7398152219209580555';
const userId = '123';

// 发送消息的函数
var placeSearch = new AMap.PlaceSearch();  //构造地点查询类
var infoWindow=new AMap.InfoWindow({
    offset: new AMap.Pixel(0, -50)
});
var markers = [];
map.on('hotspotclick', async function(result) {
try {
    const details = await new Promise((resolve, reject) => {
        placeSearch.getDetails(result.id, function(status, result) {
            if (status === 'complete' && result.info === 'OK') {
                resolve(result);
            } else {
                reject(new Error('Failed to get details'));
            }
        });
    });

    placeSearch_CallBack(details);
} catch (error) {
    console.error('Error getting place details:', error);
}
});
//回调函数
function placeSearch_CallBack(data) { 
    var poiArr = data.poiList.pois;
    if(poiArr[0]){
      var location = poiArr[0].location;
      var poiInfo = `${poiArr[0].name}`;
      infoWindow.setContent(createContent(poiArr[0]));
      infoWindow.open(map,location);
      message = poiInfo; 
      console.log(message);
      sendMessage(message); 
    }
}
map.on('click', function(e) {
var marker = new AMap.Marker({
    position: e.lnglat, // 标记的位置
    map: map // 将标记添加到地图上
});
markers.push(marker); 
setTimeout(function() {
    marker.setMap(null); // 从地图上移除标记
    markers.pop(); // 从数组中移除标记
}, 2000); 
});

function createContent(poi) {
    var s = [];
    s.push('<div class="info-title">'+poi.name+'</div><div class="info-content">'+"地址：" + poi.address);
    s.push("电话：" + poi.tel);
    s.push("类型：" + poi.type);
    s.push('<div>');
    return s.join("<br>");
}
function toggleButtonLoading(isLoading) {
  const button = document.querySelector('.chat-send-btn');
  if (isLoading) {
    button.classList.add('loading'); 
    button.disabled = true; 
  } else {
    button.classList.remove('loading'); 
    button.disabled = false; 
  }
}

async function sendMessage(message) {
    currentBubbleElement = null;
    toggleButtonLoading(true);
  if (!userInput) {
    console.log('输入是空的');
    return;
  }
  console.log('输入不是空的');
  document.getElementById('userInput').value = ''; // 清空输入框

  // 添加用户消息到聊天窗口
  const chatWindow = document.getElementById('chatWindow');
  chatWindow.innerHTML += `
<div class="chat-message right">
    <div class="bubble">${message}</div>
</div>
`;
  // 获取历史消息作为上下文
  const previousMessages = chatWindow.querySelectorAll('.chat-message .bubble');
  const additionalMessages = Array.from(previousMessages).map(message => {
    const role = message.parentNode.classList.contains('right') ? 'user' : 'assistant';
    const content = message.innerText;
    return {
      role,
      content,
      content_type: 'text'
    };
  });

  // 发起对话请求
  try {
    const response = await fetch('https://api.coze.cn/v3/chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bot_id: botId,
        user_id: userId,
        additional_messages: additionalMessages,
        stream: true,
        auto_save_history: true,
      })
    });

    // 创建一个可读流
    const reader = response.body.getReader();
    let messageContent = ''; // 用于累积消息内容
    let decoder = new TextDecoder('utf-8');

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log('Stream ended');
        break;
      }
      const chunk = decoder.decode(value, { stream: true });
      messageContent += chunk; // 累积消息内容

      // 处理累积的消息内容
      processMessageContent(messageContent);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}
let messageQueue = [];
let isTyping = false; 
let lastProcessedIndex = 0;

function processMessageContent(content) {
  let currentIndex = lastProcessedIndex;
  let eventDeltaIndex = content.indexOf('event:conversation.message.delta', currentIndex);
  let eventDoneIndex = content.indexOf('data:"[DONE]"', currentIndex); // 检测 event:done 的位置

  while (eventDeltaIndex !== -1 && (eventDoneIndex === -1 || eventDeltaIndex < eventDoneIndex)) {
    let nextEventDeltaIndex = content.indexOf('event:conversation.message.delta', eventDeltaIndex + 1);
    let endEventDeltaIndex = nextEventDeltaIndex !== -1 ? nextEventDeltaIndex : content.length;

    // 提取数据部分，移除"data:"前缀并找到 JSON 对象的结束位置 '}'
    let dataString = content.substring(eventDeltaIndex, endEventDeltaIndex);
    let dataIndex = dataString.indexOf('data:');
    let jsonEndIndex = dataString.indexOf('}', dataIndex) + 1;

    if (jsonEndIndex > 0 && dataString[jsonEndIndex - 1] === '}') {
      try {
        // 尝试解析 JSON 对象
        const dataObject = JSON.parse(dataString.substring(dataIndex + 5, jsonEndIndex));
        // 使用打字机效果逐字添加消息
        messageQueue.push(dataObject.content);
        processQueue();
      } catch (error) {
        console.error('Error parsing JSON:', error);
      }

      // 更新处理位置
      currentIndex = eventDeltaIndex + jsonEndIndex;
      eventDeltaIndex = nextEventDeltaIndex;
    } else {
      break;
    }
  }

  // 检测到 event:done，重置 messageContent
  if (eventDoneIndex !== -1) {
    messageContent = ''; // 重置内容
    lastProcessedIndex = 0; // 更新处理位置
    toggleButtonLoading(false);
    return; // 退出处理
  }

  lastProcessedIndex = currentIndex;
}

function processQueue() {
  if (!isTyping && messageQueue.length > 0) {
    isTyping = true;
    typeMessage(messageQueue.shift(), true); // 开始打字队列中的下一条消息
  }
}


let currentBubbleElement = null; 
function typeMessage(content, _isLeft) {
  // 初始化index
    let index = 0;
    // 如果当前bubble元素不存在，或者消息的方向改变了，创建一个新的bubble元素
    if (!currentBubbleElement || !currentBubbleElement.classList.contains('bubble-left')) {
      currentBubbleElement = document.createElement('div');
      currentBubbleElement.className = 'bubble bubble-left'; // 总是使用'bubble-left'样式
      currentBubbleElement.textContent = ''; // 初始化为空字符串

      // 创建一个新的chat-message元素并添加bubble
      const newMessage = document.createElement('div');
      newMessage.className = `chat-message left`; // 确保消息总是使用'left'样式
      newMessage.appendChild(currentBubbleElement);

      // 将新消息添加到chatWindow
      document.getElementById('chatWindow').appendChild(newMessage);
    }

    (function typeNextChar() {
      // 逐字添加内容
      if (index < content.length) {
        currentBubbleElement.textContent += content[index]; // 逐字添加
        index++; // 更新索引
        requestAnimationFrame(typeNextChar); 
      } else {
        isTyping = false; // 打字完成后，将标志设置为 false
        processQueue(); // 处理队列中的下一条消息
      }
    })();
}