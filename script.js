const mapsUrlOSM = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const mapsUrlGoogle = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';

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

    L.tileLayer(mapsUrlOSM, {
        continuousWorld: false,
        noWrap: true,
        minZoom: 1
    }).addTo(map);

    JSON.parse(localStorage.getItem('polygoner_save') || '[]').map(aa => aa.map(bb => ({lat: bb[0], lng: bb[1]}))).forEach(plg => addPolygon({plg, obj: L.rectangle(L.latLngBounds(...plg), {color: 'blue', weight: 1}).addTo(map)}));
    updIntersections();
    renderList();

    const deselPolygon = () => {
        if (!selPolygon) return;
        selPolygon.setStyle({color: 'green'});
        selPolygon = null;
        renderList();
    };
    const setSelPolygon = plg => {
        deselPolygon();
        if (cornerA || cornerB) return;
        selPolygon = plg;
        selPolygon.setStyle({ color: 'lime' });
        renderList();
    };

    function onMapClick(e) {
        const {latlng} = e;

        deselPolygon();
        if (latlng.lat > 90 || latlng.lat < -90 || latlng.lng < -180 || latlng.lng > 180) return;
        if (cornerA && cornerB) return;

        const currMarker = L.marker(latlng).addTo(map);
        const removeMarker = (id) => {
            currMarker.remove();
            if (id === 'a') {
                cornerA = null;
                cornerAMarker = null;
            } else {
                cornerB = null;
                cornerBMarker = null;
            }
            if (!currPolygon) return;
            currPolygon.remove();
            currPolygon = null;
        };

        if (!cornerA) {
            cornerA = latlng;
            cornerAMarker = currMarker;
            currMarker.on('click', () => removeMarker('a'));
        }
        else {
            cornerB = latlng;
            cornerBMarker = currMarker;
            currMarker.on('click', () => removeMarker('b'));
        }

        if (cornerA && cornerB) {
            currPolygon = L.rectangle(L.latLngBounds(cornerA, cornerB), {color: 'blue', weight: 1}).addTo(map);
            if (getIntersections(currPolygon).length) currPolygon.setStyle({color: 'red'});
        }
    }

    map.on('click', onMapClick);
    window.onkeyup = evt => {
        const removeCorners = () => {
            if (cornerAMarker) cornerAMarker.remove();
            if (cornerBMarker)cornerBMarker.remove();
            cornerAMarker = cornerBMarker = null;
            cornerA = cornerB = null;
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
            deselPolygon();
            removeCorners();
            if (!currPolygon) return;
            currPolygon.remove();
            currPolygon = null;
        }
        if (evt.code === 'Delete') {
            if (!selPolygon || !evt.shiftKey && !confirm('Are you sure?')) return;
            polygons.splice(polygons.findIndex(el => el.obj === selPolygon), 1);
            selPolygon.remove();
            selPolygon = null;

            storePolygons();
            updIntersections();
            renderList();
        }
    }
    function addPolygon(plgEntry) {
        polygons.push(plgEntry);
        plgEntry.obj.setStyle({ color: 'green' });
        plgEntry.obj.on('click', evt => {
            L.DomEvent.stopPropagation(evt);
            setSelPolygon(evt.target);
        });
        plgEntry.obj.on('mouseover', () => {
            polygonNodes[polygons.indexOf(plgEntry)].classList.add('hover');
        });
        plgEntry.obj.on('mouseout', () => {
            polygonNodes[polygons.indexOf(plgEntry)].classList.remove('hover');
        });
    }
    function storePolygons() {
        localStorage.setItem('polygoner_save', JSON.stringify(polygons.map(el => el.plg.map(el => [el.lat, el.lng]))));
    }
    function updIntersections() {
        intersections.clear();
        polygons.slice(0, -1).forEach((plg, idx) => {
            const its = getIntersections(plg.obj, idx + 1);
            if (its.length) intersections.add(plg.obj);
            its.forEach(el => intersections.add(el));
        });
    }
    function getIntersections(plg1, since) {
        const plg1b = plg1.getBounds();
        return polygons
            .slice(since)
            .map(plg2 => plg1b.intersects(plg2.obj.getBounds()) ? plg2.obj : null)
            .filter(el => el !== null);
    }
    function renderList() {
        const listNode = document.getElementById('polygons');
        listNode.innerHTML = '';
        polygonNodes.length = 0;
        polygons.forEach((plgItem, idx) => {
            const item = document.createElement('li');
            const {plg} = plgItem;

            item.innerHTML = `${idx + 1}. Prod = ${(plg[0].lat * plg[1].lat + plg[0].lng * plg[1].lng).toFixed(6)}`;
            item.classList.toggle('selected', plgItem.obj === selPolygon);

            item.classList.toggle('danger', intersections.has(plgItem.obj));
            item.onclick = () => {
                setSelPolygon(plgItem.obj);
            };

            listNode.append(item);
            polygonNodes.push(item);
        });
    }

    const expModal = document.getElementById('modal-exp');
    const impModal = document.getElementById('modal-imp');
    expModal.getElementsByClassName('modal-close')[0].onclick = () => expModal.style.display = 'none';
    impModal.getElementsByClassName('modal-close')[0].onclick = () => impModal.style.display = 'none';
    document.getElementById('btn-import-submit').onclick = () => {
        if (polygons.length && prompt('You will lose the data. Type "IMPORT" without quotes to continue.') !== 'IMPORT') return;
        const input = document.getElementById('imp-input');
        localStorage.setItem('polygoner_save', input.value);
        location.reload();
    };
    document.getElementById('btn-export').onclick = () => {
        const output = document.getElementById('exp-output');
        expModal.style.display = 'flex';
        output.style.display = 'initial';
        output.value = localStorage.getItem('polygoner_save') || '[]';
        output.select();
        return false;
    };
    document.getElementById('btn-import').onclick = () => {
        impModal.style.display = 'flex';
        return false;
    };
    document.getElementById('btn-delete').onclick = () => {
        if (prompt('Type "DELETE" without quotes to continue') !== 'DELETE') return false;
        localStorage.clear();
        location.reload();
    };
};
