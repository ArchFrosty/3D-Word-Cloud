var scene;
var renderer;
var SPHERE_MULT;
var raycaster;
var mouse;
var controls;
var camera;
var parsed;
var meshes = [];
var meshesGroup;
var DEBUG = false;
var fogDisabled = false;
var selectedPercentage = 0;
var selectedCount = 0;
var searchedWord = "";

//easy medium difficult
//TODO: M fix layout issues - the magical multiplier constants don't properly scale - will be different for different objects
//TODO: M highlighted word count and percentage of occurrence
//TODO: D make look pretty
//TODO: E cleanup project structure
//TODO: E disable fog checkbox
//TODO: D write doc
//TODO: D write usage scenarios
//TODO: low priority: disable clicking on far words

window.onload = function () {
    //Check the support for the File API support
    if (window.File && window.FileReader && window.FileList && window.Blob) {
        var fileSelected = document.getElementById('fileInput');
        fileSelected.addEventListener('change', function (e) {
            //Set the extension for the file
            var fileExtension = /text.*/;
            //Get the file object
            var fileTobeRead = fileSelected.files[0];
            //Check of the extension match
            if (fileTobeRead.type.match(fileExtension)) {
                //Initialize the FileReader object to read the 2file
                var fileReader = new FileReader();
                fileReader.onload = function (e) {
                    //START HERE

                    init(fileReader.result);
                };
                fileReader.readAsText(fileTobeRead);
            }
            else {
                alert("Please select text file");
            }

        }, false);
    }
    else {
        alert("Files are not supported");
    }
};

function init(text) {
    //add event listeners for reinitialization
    $("#reinit").off("click.reinit");
    $("#reinit").on("click.reinit", init);

    $("#wordSelector").off("change.wordSelector");
    $("#wordSelector").on("change.wordSelector", init);

    $("#shapeSelector").off("change.shapeSelector");
    $("#shapeSelector").on("change.shapeSelector", init);

    $("#debug").off("change.debug");
    $("#debug").on("change.debug", function () {
        DEBUG = !DEBUG;
        init();
    });

    //fog toggling doesn't need reinitialization
    $("#fog").off("change.fog");
    $("#fog").on("change.fog", function () {
        fogDisabled = !fogDisabled;
    });

    //search doesn't need reinitialization, wait 300 ms after person stopped typing to prevent excessive updates
    var timeoutid;
    $("#search").off("input");
    $("#search").on("input", function () {
        if (timeoutid) {
            clearTimeout(timeoutid);
        }
        timeoutid = setTimeout(function () {
            searchedWord = $("#search").val();
        }, 300);
    });


    //remove some HTML hacks to make the site not look horrible before this code runs
    var left = $('#canvas');
    left.empty();

    //create and add renderer to the DOM
    renderer = new THREE.WebGLRenderer();
    left.append(renderer.domElement);

    //height and width of the renderer
    var width = $(window).width() - 400;
    var height = $(window).height();

    //initialize and configure all necessary variables and objects
    scene = new THREE.Scene();
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    scene.background = new THREE.Color(0xf0f0f0);
    renderer.setSize(width, height);
    THREEx.WindowResize(renderer, camera);
    scene.add(camera);
    scene.fog = new THREE.Fog(0xf0f0f0, 100, 5000);
    controls.update();


    //max number of words to display
    var NUMWORDS = $('#numWords').val();
    //get frequencies of words
    var frequencies = parseFile(text);
    if (frequencies.length < NUMWORDS) {
        NUMWORDS = frequencies.length;
    }
    var words = [];
    for (var i = 0; i < NUMWORDS; i++) {
        words.push(frequencies[i]["normal"])
    }

    var points;

    // adjust sphere multiplier so that the points on the sphere have enough space between them
    if ($('#shapeSelector').val() == "sphere") {
        SPHERE_MULT = words.length;
        if (NUMWORDS <= 10) {
            SPHERE_MULT = words.length * 10;
        } else if (NUMWORDS <= 50 && NUMWORDS > 10) {
            SPHERE_MULT = words.length * 7.5;
        } else if (NUMWORDS <= 100 && NUMWORDS > 50) {
            SPHERE_MULT = words.length * 4;
        } else if (NUMWORDS <= 300 && NUMWORDS > 100) {
            SPHERE_MULT = words.length * 3;
        } else if (NUMWORDS <= 500 && NUMWORDS > 300) {
            SPHERE_MULT = words.length * 2;
        } else if (NUMWORDS <= 750 && NUMWORDS > 500) {
            SPHERE_MULT = words.length * 1.5;
        } else if (NUMWORDS <= 1000 && NUMWORDS > 750) {
            SPHERE_MULT = words.length;
        }
        points = fibonacciSphere(words.length);
    } else if ($('#shapeSelector').val() == "ring") {
        points = pointsOnRing(words.length, 5, 0, 0, 0);
    }


    meshes = [];
    meshesGroup = new THREE.Group();
    //get coordinates of points on sphere

    //create meshes of words
    for (i = 0; i < words.length; i++) {
        var mesh = createText2D(words[i], 'black', 'Verdana', 40);
        mesh.word = words[i];
        mesh.count = frequencies[i]["count"];
        mesh.percentage = frequencies[i]["percent"];
        mesh.selected = false;
        mesh.position.set(points[i][0], points[i][1], points[i][2]);
        meshes.push(mesh);
    }

    //add individual meshes to a group
    for (i = 0; i < meshes.length; i++) {
        meshesGroup.add(meshes[i]);
    }

    //add the group of word meshes to the scene
    scene.add(meshesGroup);

    //DEBUG
    if (DEBUG) {
        var box = new THREE.BoxHelper(meshesGroup, 0xDC143C);
        scene.add(box);
    }

    //zoom out camera to fit the group of meshes
    fitCameraToObject(camera, meshesGroup, 0.6, controls);

    //add on click event listener for word selecting, but don't register drag as click
    var dragstartpos = null;
    $(renderer.domElement).mousedown(function (event) {
        // reset dragging pos
        dragstartpos = {x: event.clientX, y: event.clientY};
    });
    $(renderer.domElement).mousemove(function (event) {
        if (dragstartpos == null) {
            return;
        } // only check if we're currently holding left click & we haven't dragged yet

        // get distance
        var diffx = dragstartpos.x - event.clientX;
        var diffy = dragstartpos.y - event.clientY;
        var distance = Math.sqrt(diffx * diffx + diffy * diffy);

        // check if we're dragging too far
        if (distance > 32) { // 32 pixels, arbitrary number, change if necessary
            dragstartpos = null; // reset var to stop checking and disable click
        }
    });
    $(renderer.domElement).mouseup(function (event) {
        if (dragstartpos == null) {
            return;
        }

        // set to null to stop check when mouse isn't pressed
        dragstartpos = null;

        return clickOnWord(event);
    });

    //start animation loop
    animate();
}

//main loop
function animate() {
    requestAnimationFrame(animate);

    //loop trough all individual meshes to find distances of individual meshes from camera and also apply appropriate rotation to them
    var closestDist = 20000, furthestDist = 0;
    scene.traverse(function (node) {
        if (node instanceof THREE.Mesh) {

            if (searchedWord != "") {
                if (!node.word.startsWith(searchedWord)) {
                    node.visible = false;
                } else {
                    node.visible = true;
                }
            } else {
                node.visible = true;
            }

            node.setRotationFromQuaternion(camera.quaternion);
            var dist = getDistFromCamera(camera, node.position.x, node.position.y, node.position.z);
            if (dist <= closestDist) {
                closestDist = dist;
            }
            if (dist >= furthestDist) {
                furthestDist = dist;
            }
        }
    });

    //use the distances to dynamically adjust fog, so that it starts right after the closest mesh and ends close after the furthest mesh, so that the density of the fog stays correct with different camera distances
    if (fogDisabled) {
        //if fog is disabled just set its distance out of rendering distance - this is much cheaper than reinitializing shader and renderer
        scene.fog.near = 20000;
        scene.fog.far = 20001;
    } else {
        scene.fog.near = closestDist - (furthestDist - closestDist) / 2;
        scene.fog.far = furthestDist + 100;
    }

    //render the current frame
    renderer.render(scene, camera);
    //update controls
    controls.update();
}

//draws line that represents ray from the raycaster object
function drawRaycastLine(raycaster) {
    var material = new THREE.LineBasicMaterial({
        color: 0xff0000,
        linewidth: 10
    });
    var geometry = new THREE.Geometry();
    var startVec = new THREE.Vector3(
        raycaster.ray.origin.x,
        raycaster.ray.origin.y,
        raycaster.ray.origin.z);

    var endVec = new THREE.Vector3(
        raycaster.ray.direction.x,
        raycaster.ray.direction.y,
        raycaster.ray.direction.z);

    // length of line
    endVec.multiplyScalar(5000);

    // get the point in the middle
    var midVec = new THREE.Vector3();
    midVec.lerpVectors(startVec, endVec, 0.5);

    geometry.vertices.push(startVec);
    geometry.vertices.push(midVec);
    geometry.vertices.push(endVec);

    console.log('vec start', startVec);
    console.log('vec mid', midVec);
    console.log('vec end', endVec);

    var line = new THREE.Line(geometry, material);
    this.scene.add(line);
}

//word selection
function clickOnWord(event) {
    //calculate transformation of click event coordinates to world coordinates
    mouse.x = ( event.clientX / renderer.domElement.clientWidth ) * 2 - 1;
    mouse.y = -( event.clientY / renderer.domElement.clientHeight ) * 2 + 1;

    //set raycaster to cast ray from camera to the clicked point
    raycaster.setFromCamera(mouse, camera);

    //DEBUG
    if (DEBUG) {
        drawRaycastLine(raycaster);
    }

    //get all objects the ray intersected
    var intersects = raycaster.intersectObjects(meshes);
    //replace the mesh for new one with different colored text to indicate highlighting and do other on highlight stuff
    if (intersects.length > 0) {
        var word = intersects[0].object.word;
        var canvas;
        if (intersects[0].object.selected) {
            canvas = createTextCanvas(word, 'Black', 'Verdana', 40);
            intersects[0].object.selected = false;
        } else {
            canvas = createTextCanvas(word, 'Red', 'Verdana', 40);
            intersects[0].object.selected = true;
        }
        var tex = new THREE.Texture(canvas);
        tex.needsUpdate = true;
        var planeMat = new THREE.MeshBasicMaterial({
            map: tex, color: 0xffffff, transparent: true
        });
        intersects[0].object.material = planeMat;

        if (intersects[0].object.selected) {
            selectedCount += intersects[0].object.count;
            selectedPercentage += intersects[0].object.percentage;
        } else {
            selectedCount -= intersects[0].object.count;
            selectedPercentage -= intersects[0].object.percentage;
        }
        // round to 5 decimal places to account for float inaccuracies
        if(Math.round(selectedPercentage * 100000) / 100000 === 0){
            $('#percent').val("N/A");
        }else {
            $('#percent').val(Math.round(selectedPercentage * 100000) / 100000);
        }
        if(selectedCount === 0){
            $('#count').val("N/A");
        }else {
            $('#count').val(selectedCount);
        }

        //DEBUG
        if (DEBUG) {
            console.log(intersects[0]);
        }
    }
}

function getDistFromCamera(camera, x, y, z) {
    var cameraDistance = new THREE.Vector3();
    var target = new THREE.Vector3(x, y, z);
    cameraDistance.subVectors(camera.position, target);
    return cameraDistance.length();
}

//get nearest higher or equal power of two
function nearestPow2(aSize) {
    return Math.pow(2, Math.ceil(Math.log(aSize) / Math.log(2)));
}

//create canvas with text, from which texture will be created
function createTextCanvas(text, color, font, size) {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    var fontStr = size + 'px ' + font;
    ctx.font = fontStr;
    //measure width of text and add arbitrary multiplier, because the measurement is too narrow
    var w = ctx.measureText(text).width * 1.07;
    var h = size;
    w = w > 512 ? 512 : w; // clamp width of canvas to 512, in case text is too long, it gets cut off
    //if the dimensions of canvas (and therefore the texture) are not power two, three.js will internally scale the texture,
    //it will still fit the canvas (and therefore the geometry, because it is the same size as canvas) but the text will be blurry because of it
    //however if we create canvas of appropriate power of two size, it will be larger than the text itself, and therefore break the clicking
    //-clicking seemingly empty space will highlight words
    canvas.width = w; //nearestPow2(w);
    //this is not an issue with height, because it is constant and the size of font can be preselected to look good
    canvas.height = nearestPow2(h);
    ctx.font = fontStr;
    ctx.fillStyle = color || 'black';
    ctx.fillText(text, 4, size);
    return canvas;
}

//create mesh with text on it
function createText2D(text, color, font, size, segW, segH) {
    var canvas = createTextCanvas(text, color, font, size);
    var plane = new THREE.PlaneGeometry(canvas.width, canvas.height, segW, segH);
    var tex = new THREE.Texture(canvas);
    tex.needsUpdate = true;
    var planeMat = new THREE.MeshBasicMaterial({
        map: tex, color: 0xffffff, transparent: true
    });
    var mesh = new THREE.Mesh(plane, planeMat);
    mesh.doubleSided = true;
    return mesh;
}

//get "samples" number of points on sphere, and scale them with SPHERE_MULT
function fibonacciSphere(samples) {
    var points = [];
    var offset = 2. / samples;
    var increment = Math.PI * (3. - Math.sqrt(5.));

    for (var i = 0; i < samples; i++) {
        var y = ((i * offset) - 1) + (offset / 2);
        var r = Math.sqrt(1 - Math.pow(y, 2));

        phi = ((i + 1) % samples) * increment;

        x = Math.cos(phi) * r;
        z = Math.sin(phi) * r;

        points.push([x * SPHERE_MULT, y * SPHERE_MULT, z * SPHERE_MULT])
    }
    return points;
}

function pointsOnRing(samples, radius, centerX, centerY, centerZ) {
    var points = [];
    var slice = 2 * Math.PI / samples;
    for (var i = 0; i < samples; i++) {
        var angle = slice * i;
        var x = centerX;
        var y = centerY + radius * Math.sin(angle);
        var z = centerZ + radius * Math.cos(angle);
        points.push([x * SPHERE_MULT, y * SPHERE_MULT, z * SPHERE_MULT]);
    }
    return points;
}


function fitCameraToObject(camera, object, offset, controls) {

    offset = offset || 1.25;

    var boundingBox = new THREE.Box3();

    // get bounding box of object - this will be used to setup controls and camera
    boundingBox.setFromObject(object);

    var center = boundingBox.getCenter();

    var size = boundingBox.getSize();

    console.log(size);

    // get the max side of the bounding box (fits to width OR height as needed )
    var maxDim = Math.max(size.x, size.y, size.z);
    var fov = camera.fov * ( Math.PI / 180 );
    var cameraZ = Math.abs(maxDim / Math.sin(fov / 2));

    cameraZ *= offset; // zoom out (or in) a little so that objects don't fill the screen

    camera.position.z = cameraZ;

    var minZ = boundingBox.min.z;
    var cameraToFarEdge = ( minZ < 0 ) ? -minZ + cameraZ : cameraZ - minZ;

    camera.far = cameraToFarEdge * 3;
    camera.updateProjectionMatrix();

    if (controls) {

        // set camera to rotate around center of loaded object
        controls.target = center;

        // prevent camera from zooming out far enough to create far plane cutoff
        controls.maxDistance = cameraToFarEdge * 2;

        controls.saveState();

    } else {

        camera.lookAt(center)

    }
}


function parseFile(text) {

    if (parsed == null) {
        var nlp = window.nlp;
        parsed = nlp(text);
    }

    switch ($('#wordSelector').val()) {
        case "acronyms":
            return parsed.acronyms().out('freq');
            break;
        case "adjectives":
            return parsed.adjectives().out('freq');
            break;
        case "adverbs":
            return parsed.adverbs().out('freq');
            break;
        case "clauses":
            return parsed.clauses().out('freq');
            break;
        case "hashTags":
            return parsed.hashTags().out('freq');
            break;
        case "phoneNumbers":
            return parsed.phoneNumbers().out('freq');
            break;
        case "quotations":
            return parsed.quotations().out('freq');
            break;
        case "statements":
            return parsed.statements().out('freq');
            break;
        case "terms":
            return parsed.terms().out('freq');
            break;
        case "topics":
            return parsed.topics().out('freq');
            break;
        case "urls":
            return parsed.urls().out('freq');
            break;
        case "verbs":
            return parsed.verbs().out('freq');
            break;
        case "contractions":
            return parsed.contractions().out('freq');
            break;
        case "values":
            return parsed.values().out('freq');
            break;
        case "nouns":
            return parsed.nouns().out('freq');
            break;
        case "people":
            return parsed.people().out('freq');
            break;
        case "places":
            return parsed.places().out('freq');
            break;
    }
}

