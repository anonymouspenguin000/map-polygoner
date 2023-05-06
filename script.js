const mapUrls = {
    OSM: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    ERSI: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}.jpg',
    ERSI_SATELLITE: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}.jpg',
    GOOGLE: 'https://mt.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    GOOGLE_SATELLITE: 'https://mt.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    STAMEN: 'http://a.tile.stamen.com/watercolor/{z}/{x}/{y}.jpg',
    MAPS_FOR_FREE: 'https://maps-for-free.com/layer/relief/z{z}/row{y}/{z}_{x}-{y}.jpg',
    CITY_LIGHT: 'http://map1.vis.earthdata.nasa.gov/wmts-webmerc/VIIRS_CityLights_2012/default//GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg',
    CARTO: 'https://cartodb-basemaps-b.global.ssl.fastly.net/light_nolabels/{z}/{x}/{y}.png',
    ARCGIS: 'http://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'
};

const mapUrl = mapUrls.OSM;
const styles = {
    CREATE: {color: '#00c', weight: 1},
    INTERSECTS: {color: '#f00', weight: 1},
    NORMAL: {color: '#090', weight: 1},
    SELECTED: {color: '#6c0', weight: 1}
};
const storeKey = 'polygoner_save';

const getSaved = () => localStorage.getItem(storeKey) || '[]';
const getid = id => document.getElementById(id);

window.onload = () => {
    const map = L.map('map').setView([0, 0], 2);
    const polygons = [];
    const polygonNodes = [];
    const intersections = new Set();

    let selPolygon = null;
    let currPolygon = null;

    let cornerA = null;
    let cornerB = null;
    let cornerAMarker = null;
    let cornerBMarker = null;

    L.tileLayer(mapUrl, {
        continuousWorld: false,
        noWrap: true,
        minZoom: 1
    }).addTo(map);

    const createPolygonObject = (ca, cb) => L.rectangle(L.latLngBounds(ca, cb), styles.CREATE).addTo(map);
    const getNodeByPolygon = plg => polygonNodes[polygons.indexOf(plg)];

    function deselectPolygon() {
        if (!selPolygon) return;
        selPolygon.setStyle(styles.NORMAL);
        selPolygon = null;
        renderList();
    }
    function selectPolygon(plg) {
        deselectPolygon();
        if (cornerA || cornerB) return;
        selPolygon = plg;
        selPolygon.setStyle(styles.SELECTED);
        renderList();
    }
    function storePolygons() {
        localStorage.setItem(storeKey, JSON.stringify(polygons.map(plg => plg.plg.map(vtx => [vtx.lat, vtx.lng]))));
    }
    function getIntersections(plg, since) {
        const plg1b = plg.getBounds();
        return polygons
            .slice(since)
            .map(plg2 => plg1b.intersects(plg2.obj.getBounds()) ? plg2.obj : null)
            .filter(its => its !== null);
    }
    function updIntersections() {
        intersections.clear();
        polygons.slice(0, -1).forEach((plg, idx) => {
            const curr = getIntersections(plg.obj, idx + 1);
            if (curr.length) intersections.add(plg.obj);
            curr.forEach(its => intersections.add(its));
        });
    }

    JSON.parse(getSaved())
        .map(plg => plg.map(vtx => ({lat: vtx[0], lng: vtx[1]})))
        .forEach(plg => addPolygon({plg, obj: createPolygonObject(...plg)}));
    updIntersections();
    renderList();

    map.on('click', evt => {
        const {latlng} = evt;

        deselectPolygon();
        if (latlng.lat > 90 || latlng.lat < -90 || latlng.lng < -180 || latlng.lng > 180) return;
        if (currPolygon) return;

        const currMarker = L.marker(latlng).addTo(map);
        const removeMarker = (name) => {
            if (name === 'A') {
                cornerA = null;
                cornerAMarker.remove();
                cornerAMarker = null;
            }
            if (name === 'B') {
                cornerB = null;
                cornerBMarker.remove();
                cornerBMarker = null;
            }

            if (currPolygon) {
                currPolygon.remove();
                currPolygon = null;
            }
        };

        if (!cornerA) {
            cornerA = latlng;
            cornerAMarker = currMarker;
            currMarker.on('click', () => removeMarker('A'));
        }
        else {
            cornerB = latlng;
            cornerBMarker = currMarker;
            currMarker.on('click', () => removeMarker('B'));
        }

        if (cornerA && cornerB) {
            currPolygon = createPolygonObject(cornerA, cornerB);
            if (getIntersections(currPolygon).length) currPolygon.setStyle(styles.INTERSECTS);
        }
    });
    window.onkeyup = evt => {
        const removeCorners = () => {
            if (cornerAMarker) cornerAMarker.remove();
            if (cornerBMarker) cornerBMarker.remove();
            cornerA = cornerB = null;
            cornerAMarker = cornerBMarker = null;
        };
        if (evt.code === 'Enter') {
            if (!currPolygon) return;
            addPolygon({plg: [cornerA, cornerB], obj: currPolygon});
            removeCorners();
            currPolygon = null;

            storePolygons();
            updIntersections();
            renderList();
        }
        if (evt.code === 'Escape') {
            deselectPolygon();
            removeCorners();
            if (currPolygon) {
                currPolygon.remove();
                currPolygon = null;
            }
        }
        if (evt.code === 'Delete') {
            if (!selPolygon || !evt.shiftKey && !confirm('Are you sure to delete the polygon?')) return;

            polygons.splice(polygons.findIndex(plg => plg.obj === selPolygon), 1);
            selPolygon.remove();
            selPolygon = null;

            storePolygons();
            updIntersections();
            renderList();
        }
    }
    function addPolygon(plg) {
        polygons.push(plg);
        plg.obj.setStyle(styles.NORMAL);
        plg.obj.on('click', evt => {
            L.DomEvent.stopPropagation(evt);
            selectPolygon(evt.target);
        });
        plg.obj.on('mouseover', () => {
            getNodeByPolygon(plg).classList.add('hover');
        });
        plg.obj.on('mouseout', () => {
            getNodeByPolygon(plg).classList.remove('hover');
        });
    }
    function renderList() {
        const listNode = getid('polygons');
        listNode.innerHTML = '';
        polygonNodes.length = 0;
        polygons.forEach((plgItem, idx) => {
            const item = document.createElement('li');
            const {plg, obj} = plgItem;

            item.innerHTML = `${idx + 1}. Prod = ${(plg[0].lat * plg[1].lat + plg[0].lng * plg[1].lng).toFixed(6)}`;
            item.classList.toggle('selected', obj === selPolygon);
            item.classList.toggle('danger', intersections.has(obj));
            item.onclick = () => {
                selectPolygon(obj);
            };

            listNode.append(item);
            polygonNodes.push(item);
        });
    }

    const expModal = getid('modal-exp');
    const impModal = getid('modal-imp');

    expModal.getElementsByClassName('modal-close')[0].onclick = () => expModal.style.display = 'none';
    impModal.getElementsByClassName('modal-close')[0].onclick = () => impModal.style.display = 'none';

    getid('btn-import-submit').onclick = () => {
        if (polygons.length && prompt('You will lose the data. Type "IMPORT" without quotes to continue.') !== 'IMPORT') return;
        const input = getid('imp-input');
        localStorage.setItem(storeKey, input.value);
        location.reload();
    };
    getid('btn-export').onclick = () => {
        const output = getid('exp-output');
        expModal.style.display = 'flex';
        output.style.display = 'initial';
        output.value = getSaved();
        output.select();
    };
    getid('btn-import').onclick = () => {
        impModal.style.display = 'flex';
    };
    getid('btn-delete').onclick = () => {
        if (prompt('Type "DELETE" without quotes to continue') !== 'DELETE') return;
        localStorage.clear();
        location.reload();
    };
};
