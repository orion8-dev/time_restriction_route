// マップオブジェクトと中心座標の設定
let map, polyline;

let formattedDepartureTime = '';

// Initialize Flatpickr with Japanese locale
flatpickr("#datetime", {
    enableTime: true,
    enableSeconds: true, // Enable seconds selection
    altInput: true,
    altFormat: "Y年m月d日 H:i:S", // Human-readable format including seconds
    dateFormat: "YmdHis", // API-ready format including seconds
    locale: "ja",
    onChange: function (selectedDates, dateStr) {
        formattedDepartureTime = dateStr;
        console.log("Formatted departure time: " + formattedDepartureTime);
    }
});


// ルート情報（所要時間と距離）を表示する関数
function showRouteInfo(rawDuration, rawDistance) {
    convertTime(rawDuration);
    convertDtn(rawDistance);
}

// 経由地にマーカーを表示する関数
function showMarker(waypoints) {
    waypoints.forEach((location, index) => {
        const marker = new ZDC.Marker(
            new ZDC.LatLng(location.lat, location.lng),
            {
                styleId: ZDC.MARKER_COLOR_ID_RED_L,
                contentStyleId: ZDC[`MARKER_NUMBER_ID_${index + 1}_L`],
            }
        );
        map.addWidget(marker);
    });
}

// 経由地の文字列を解析し、最適化された順序で配列を返す関数
function parseWaypoints(waypointString, origin, destination, routeorder) {
    const coordinates = waypointString.split(",").map(Number);
    const waypoints = [origin];

    for (let i = 0; i < coordinates.length; i += 2) {
        const lng = coordinates[i];
        const lat = coordinates[i + 1];
        waypoints.push(new ZDC.LatLng(lat, lng));
    }
    optWaypts = waypointOpt(waypoints, routeorder);
    optWaypts.push(destination);
    return optWaypts;
}

// 経由地の順序を最適化する関数
function waypointOpt(waypoints, routeorder) {
    let stringArray = routeorder.split(',');
    let integerArray = stringArray.map(num => parseInt(num, 10));
    integerArray = [0, ...integerArray];
    const optWaypts = [];
    for (let i = 0; i < integerArray.length; i++) {
        optWaypts.push(waypoints[integerArray[i]]);
    }
    return optWaypts

}

// 所要時間を適切な形式で表示する関数
function convertTime(rawDuration) {
    const timeInfoArea = document.getElementById('time');
    if (timeInfoArea) {
        const hours = Math.floor(rawDuration / 60);
        const minutes = (rawDuration % 60).toFixed(0);

        if (hours === 0 && minutes > 0) {
            timeInfoArea.textContent = `${minutes}分`;
        } else if (hours > 0 && minutes === 0) {
            timeInfoArea.textContent = `${hours}時間`;
        } else if (hours > 0 && minutes > 0) {
            timeInfoArea.textContent = `${hours}時間${minutes}分`;
        } else {
            timeInfoArea.textContent = 'すぐに到着します';
        }
    } else {
        console.error("所要時間の表示エリアが見つかりません。");
    }
}

// 距離をキロメートル単位で表示する関数
function convertDtn(rawDistance) {
    const distInfoArea = document.getElementById('dist');
    if (rawDistance && distInfoArea) {
        const distanceInKm = (rawDistance / 1000).toFixed(1);
        distInfoArea.textContent = `${distanceInKm} km`;
    } else {
        console.error("距離の表示エリアが見つかりません。");
    }
}

function getFormattedDepartureTime() {
    if (formattedDepartureTime) {
        // If length is 12 (YYYYMMDDhhmm), append '00' for seconds
        if (formattedDepartureTime.length <= 13) {
            return formattedDepartureTime + '0';
        }
        return formattedDepartureTime;
    } else {
        // Return current date and time in required format
        return new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    }
}
// ルート検索を実行する関数
function performRouteSearch(origin, destination) {
    if (polyline) {
        map.removeWidget(polyline);
    }
    const startPoint = `${origin.lng},${origin.lat}`;
    const goalPoint = `${destination.lng},${destination.lat}`;
    const api = "/route/route_mbn/drive_ptp";

    // Use the user-selected departure time if available; otherwise, fallback to current datetime
    const departureTime = getFormattedDepartureTime();

    const params = {
        search_type: 1,
        from: startPoint,
        to: goalPoint,
        time_restriction: true,
        departure_time: departureTime,
    };

    try {
        map.requestAPI(api, params, function (response) {
            if (response.ret && response.ret.status === 'OK') {
                console.log(response);
                const route = response.ret.message.result.item[0].route;
                const coordinates = route.link.flatMap(link =>
                    link.line.coordinates.map(coord => new ZDC.LatLng(coord[1], coord[0]))
                );

                const bounds = calculatePolylineBounds(coordinates);
                if (bounds) {
                    const adjustZoom = map.getAdjustZoom(coordinates, { fix: false });
                    map.setCenter(adjustZoom.center);
                    map.setZoom(adjustZoom.zoom - 0.5);
                }

                const rawDuration = route.time;
                const rawDistance = route.distance;
                const waypoints = [origin, destination];
                showMarker(waypoints);
                showRouteInfo(rawDuration, rawDistance);

                polyline = new ZDC.Polyline(coordinates, {
                    color: 'green',
                    width: 4,
                    pattern: 'solid',
                    opacity: 0.7
                });
                map.addWidget(polyline);
            } else {
                console.error("ルート検索に失敗しました。");
            }
        });
    } catch (error) {
        console.error("ルート検索中にエラーが発生しました:", error);
    }
}

// Function to calculate the bounds of a polyline 
function calculatePolylineBounds(polylineCoordinates) {
    if (!polylineCoordinates || polylineCoordinates.length === 0) {
        console.log('ポリラインの座標が無効です。');
    }

    let minLat = Number.POSITIVE_INFINITY;
    let maxLat = Number.NEGATIVE_INFINITY;
    let minLng = Number.POSITIVE_INFINITY;
    let maxLng = Number.NEGATIVE_INFINITY;

    polylineCoordinates.forEach(point => {
        if (point.lat < minLat) minLat = point.lat;
        if (point.lat > maxLat) maxLat = point.lat;
        if (point.lng < minLng) minLng = point.lng;
        if (point.lng > maxLng) maxLng = point.lng;
    });

    const southWest = new ZDC.LatLng(minLat, minLng);
    const northEast = new ZDC.LatLng(maxLat, maxLng);
    const bounds = new ZDC.LatLngBounds(southWest, northEast);

    return bounds;
}

// ZMALoaderの初期化
ZMALoader.setOnLoad(function (mapOptions, error) {
    if (error) {
        console.error(error);
        return;
    }
    // mapOptions.center = new ZDC.LatLng(mapCenter.lat, mapCenter.lng);
    mapOptions.zoom = 13;
    mapOptions.centerZoom = false; // ★地図の中心点を中心に拡大縮小する指定
    mapOptions.mouseWheelReverseZoom = true;
    mapOptions.minZoom = 4.5;

    map = new ZDC.Map(
        document.getElementById('ZMap'),
        mapOptions,
        function () {

            map.addControl(new ZDC.ZoomButton('bottom-left'));
            map.addControl(new ZDC.Compass('top-right'));
            map.addControl(new ZDC.ScaleBar('bottom-left'));

            // Example usage triggered by a button click:
            document.getElementById('searchButton').addEventListener('click', function () {
                // Replace these with your actual origin and destination data
                const origin = new ZDC.LatLng(35.703874744612726, 139.73442305859913); // 神楽坂駅
                const destination = new ZDC.LatLng(35.700504770928035, 139.74237209059712); // モスバーガー神楽坂下店
                performRouteSearch(origin, destination);
            });
        },
        function () {
            console.log("APIエラー");
        }
    );
});