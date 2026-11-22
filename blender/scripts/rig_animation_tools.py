"""Shared animation baking helpers; extracted from the existing validated rig pipeline."""
from __future__ import annotations
from array import array
import hashlib, json, math
from pathlib import Path
import bpy
from mathutils import Matrix, Quaternion, Vector
FPS=60
PULL_DURATION=4.2
PULL_END_FRAME=252
def sha256(values: bytes) -> str:
    return hashlib.sha256(values).hexdigest()

def immutable_scene_signature() -> dict:
    """Hash all visual/rest data that this animation-only pass must preserve."""
    meshes = {}
    for obj in sorted((item for item in bpy.data.objects if item.type == "MESH"), key=lambda item: item.name):
        coordinates = array("f", (component for vertex in obj.data.vertices for component in vertex.co))
        loop_indices = array("I", (loop.vertex_index for loop in obj.data.loops))
        group_data = []
        for vertex in obj.data.vertices:
            group_data.extend(
                (vertex.index, assignment.group, round(float(assignment.weight), 7))
                for assignment in vertex.groups
            )
        meshes[obj.name] = {
            "coordinates": sha256(coordinates.tobytes()),
            "loop_indices": sha256(loop_indices.tobytes()),
            "vertices": len(obj.data.vertices),
            "polygons": len(obj.data.polygons),
            "materials": [slot.material.name if slot.material else None for slot in obj.material_slots],
            "uv_layers": [layer.name for layer in obj.data.uv_layers],
            "weights": sha256(json.dumps(group_data, separators=(",", ":")).encode("utf-8")),
            "parent": obj.parent.name if obj.parent else None,
            "parent_type": obj.parent_type,
            "parent_bone": obj.parent_bone,
            "matrix_world": [round(float(value), 8) for row in obj.matrix_world for value in row],
        }

    images = {}
    for image in sorted(bpy.data.images, key=lambda item: item.name):
        if image.packed_file:
            images[image.name] = sha256(bytes(image.packed_file.data))
        elif image.source == "FILE" and image.filepath:
            path = Path(bpy.path.abspath(image.filepath))
            images[image.name] = sha256(path.read_bytes()) if path.exists() else "missing-external"

    rig = bpy.data.objects["Mascot_Rig"]
    bones = {
        bone.name: {
            "parent": bone.parent.name if bone.parent else None,
            "matrix_local": [round(float(value), 8) for row in bone.matrix_local for value in row],
            "use_deform": bone.use_deform,
        }
        for bone in rig.data.bones
    }
    return {
        "meshes": meshes,
        "materials": sorted(material.name for material in bpy.data.materials),
        "images": images,
        "bones": bones,
    }

def reset_pose(rig: bpy.types.Object) -> None:
    if rig.animation_data:
        rig.animation_data.action = None
    for pose_bone in rig.pose.bones:
        pose_bone.rotation_mode = "QUATERNION"
        pose_bone.location = (0.0, 0.0, 0.0)
        pose_bone.rotation_quaternion = (1.0, 0.0, 0.0, 0.0)
        pose_bone.scale = (1.0, 1.0, 1.0)
    bpy.context.scene.frame_set(0)
    bpy.context.view_layer.update()

def clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))

def smootherstep(value: float) -> float:
    value = clamp01(value)
    return value**3 * (value * (value * 6.0 - 15.0) + 10.0)

def ease(time: float, start: float, end: float) -> float:
    if end <= start:
        return 1.0 if time >= end else 0.0
    return smootherstep((time - start) / (end - start))

def pulse(time: float, start: float, peak: float, end: float) -> float:
    if time <= start or time >= end:
        return 0.0
    if time <= peak:
        return ease(time, start, peak)
    return 1.0 - ease(time, peak, end)

def mix(first: Vector, second: Vector, amount: float) -> Vector:
    return first.lerp(second, clamp01(amount))

def cubic_bezier(a: Vector, b: Vector, c: Vector, d: Vector, amount: float) -> Vector:
    amount = clamp01(amount)
    inverse = 1.0 - amount
    return (
        a * inverse**3
        + b * (3.0 * inverse**2 * amount)
        + c * (3.0 * inverse * amount**2)
        + d * amount**3
    )

def basis_from_armature_matrix(
    rig: bpy.types.Object,
    name: str,
    desired: Matrix,
    posed_matrices: dict[str, Matrix],
) -> Matrix:
    bone = rig.data.bones[name]
    if bone.parent:
        parent_matrix = posed_matrices.get(bone.parent.name, bone.parent.matrix_local)
        base = parent_matrix @ bone.parent.matrix_local.inverted() @ bone.matrix_local
    else:
        base = bone.matrix_local
    return base.inverted() @ desired

def solve_arm(
    rig: bpy.types.Object,
    side: str,
    wrist_target: Vector,
    pole_vector: Vector,
    clavicle_degrees: float,
) -> dict[str, Matrix]:
    """Two-bone IK that preserves the validated v2 wrist rest orientation."""
    sign = 1.0 if side == "L" else -1.0
    matrices: dict[str, Matrix] = {}
    clavicle = rig.data.bones[f"Clavicle_{side}"]
    clavicle_q = (
        Quaternion(Vector((0.0, 1.0, 0.0)), math.radians(-sign * clavicle_degrees))
        @ clavicle.matrix_local.to_quaternion()
    )
    clavicle_matrix = Matrix.LocRotScale(clavicle.head_local, clavicle_q, Vector((1.0, 1.0, 1.0)))
    matrices[clavicle.name] = clavicle_matrix

    upper = rig.data.bones[f"Arm_{side}"]
    forearm = rig.data.bones[f"Forearm_{side}"]
    hand = rig.data.bones[f"Hand_{side}"]
    shoulder = clavicle_matrix @ clavicle.matrix_local.inverted() @ upper.head_local
    upper_length = (forearm.head_local - upper.head_local).length
    forearm_length = (hand.head_local - forearm.head_local).length
    reach = wrist_target - shoulder
    distance = min(reach.length, upper_length + forearm_length - 0.01)
    direction = reach.normalized()
    along = (upper_length**2 - forearm_length**2 + distance**2) / (2.0 * distance)
    height = math.sqrt(max(0.0, upper_length**2 - along**2))
    bend = pole_vector - direction * pole_vector.dot(direction)
    if bend.length < 1.0e-5:
        bend = Vector((sign, -0.25, 0.0))
    bend.normalize()
    elbow = shoulder + direction * along + bend * height

    upper_rest_q = (clavicle_matrix @ clavicle.matrix_local.inverted() @ upper.matrix_local).to_quaternion()
    upper_q = (
        (upper_rest_q @ Vector((0.0, 1.0, 0.0))).rotation_difference((elbow - shoulder).normalized())
        @ upper_rest_q
    )
    upper_matrix = Matrix.LocRotScale(shoulder, upper_q, Vector((1.0, 1.0, 1.0)))
    matrices[upper.name] = upper_matrix

    forearm_rest_q = (upper_matrix @ upper.matrix_local.inverted() @ forearm.matrix_local).to_quaternion()
    forearm_q = (
        (forearm_rest_q @ Vector((0.0, 1.0, 0.0))).rotation_difference((wrist_target - elbow).normalized())
        @ forearm_rest_q
    )
    forearm_matrix = Matrix.LocRotScale(elbow, forearm_q, Vector((1.0, 1.0, 1.0)))
    matrices[forearm.name] = forearm_matrix

    # Never impose a world-space palm orientation.  This is the v2 shoulder /
    # web-shooter seam fix and is intentionally retained unchanged.
    hand_matrix = forearm_matrix @ forearm.matrix_local.inverted() @ hand.matrix_local
    matrices[hand.name] = hand_matrix
    return {
        name: basis_from_armature_matrix(rig, name, matrix, matrices)
        for name, matrix in matrices.items()
    }

def interpolate_basis(first: Matrix, second: Matrix, amount: float) -> Matrix:
    amount = clamp01(amount)
    first_q = first.to_quaternion().normalized()
    second_q = second.to_quaternion().normalized()
    if first_q.dot(second_q) < 0.0:
        second_q.negate()
    location = first.to_translation().lerp(second.to_translation(), amount)
    rotation = first_q.slerp(second_q, amount)
    return Matrix.LocRotScale(location, rotation, Vector((1.0, 1.0, 1.0)))

def continuous_quaternion(quaternion: Quaternion, previous: Quaternion | None) -> Quaternion:
    quaternion.normalize()
    if previous is not None and quaternion.dot(previous) < 0.0:
        quaternion.negate()
    return quaternion

def set_linear_interpolation(action: bpy.types.Action) -> None:
    # Per-frame samples already contain the authored easing.  Linear playback
    # faithfully preserves those samples and avoids exporter handle surprises.
    for layer in action.layers:
        for strip in layer.strips:
            for slot in action.slots:
                bag = strip.channelbag(slot)
                if not bag:
                    continue
                for curve in bag.fcurves:
                    for key in curve.keyframe_points:
                        key.interpolation = "LINEAR"

def create_pull_shutter(rig: bpy.types.Object) -> dict:
    previous = bpy.data.actions.get("PullShutter")
    if previous:
        bpy.data.actions.remove(previous)
    reset_pose(rig)
    rig.animation_data_create()
    action = bpy.data.actions.new("PullShutter")
    action.use_fake_user = True
    rig.animation_data.action = action

    palm_axes = {}
    for side in ("L", "R"):
        wrist = rig.data.bones[f"Hand_{side}"].head_local
        long_axis = (rig.data.bones[f"Middle_01_{side}"].head_local - wrist).normalized()
        lateral = (
            rig.data.bones[f"Index_01_{side}"].head_local
            - rig.data.bones[f"Pinky_01_{side}"].head_local
        ).normalized()
        palm_axes[side] = long_axis.cross(lateral).normalized() * (1.0 if side == "L" else -1.0)
    arm_anchors = {side: build_arm_anchors(rig, side) for side in ("L", "R")}

    keyed_names = ["Root", "Torso", "Head"]
    for side in ("L", "R"):
        keyed_names.extend([f"Clavicle_{side}", f"Arm_{side}", f"Forearm_{side}", f"Hand_{side}"])
        for finger in ("Thumb", "Index", "Middle", "Ring", "Pinky"):
            keyed_names.extend(f"{finger}_{index:02}_{side}" for index in range(1, 4))

    previous_quaternions: dict[str, Quaternion] = {}
    records = []
    for frame in range(0, PULL_END_FRAME + 1):
        time = frame / FPS
        for pose_bone in rig.pose.bones:
            pose_bone.rotation_mode = "QUATERNION"
            pose_bone.location = (0.0, 0.0, 0.0)
            pose_bone.rotation_quaternion = (1.0, 0.0, 0.0, 0.0)
            pose_bone.scale = (1.0, 1.0, 1.0)

        body = body_pose(time)
        rig.pose.bones["Root"].location = body["root_location"]
        rig.pose.bones["Root"].rotation_quaternion = Quaternion(
            (0.0, 1.0, 0.0), math.radians(body["root_yaw"])
        )
        rig.pose.bones["Torso"].rotation_quaternion = (
            Quaternion((0.0, 1.0, 0.0), math.radians(body["torso_yaw"]))
            @ Quaternion((1.0, 0.0, 0.0), math.radians(body["torso_pitch"]))
            @ Quaternion((0.0, 0.0, 1.0), math.radians(body["torso_roll"]))
        )
        rig.pose.bones["Head"].rotation_quaternion = (
            Quaternion((0.0, 1.0, 0.0), math.radians(body["head_yaw"]))
            @ Quaternion((1.0, 0.0, 0.0), math.radians(body["head_pitch"]))
            @ Quaternion((0.0, 0.0, 1.0), math.radians(body["head_roll"]))
        )

        for side in ("L", "R"):
            arm_basis = arm_basis_at(arm_anchors[side], side, time)
            for name, basis in arm_basis.items():
                pose_bone = rig.pose.bones[name]
                pose_bone.location = basis.to_translation()
                pose_bone.rotation_quaternion = basis.to_quaternion()

            for finger in ("Thumb", "Index", "Middle", "Ring", "Pinky"):
                curl = finger_grip(time, finger, side)
                angles = (27.0, 37.0, 29.0) if finger == "Thumb" else (54.0, 68.0, 42.0)
                for index, degrees in enumerate(angles, 1):
                    name = f"{finger}_{index:02}_{side}"
                    bone = rig.data.bones[name]
                    direction = (bone.tail_local - bone.head_local).normalized()
                    axis = direction.cross(palm_axes[side]).normalized()
                    local_axis = bone.matrix_local.to_quaternion().inverted() @ axis
                    rig.pose.bones[name].rotation_quaternion = Quaternion(
                        local_axis, math.radians(degrees) * curl
                    )

        # Force every keyed quaternion onto the same hemisphere as its previous
        # sample.  This removes the single-frame 360-degree flips that otherwise
        # occur when the IK solution crosses quaternion sign boundaries.
        for name in keyed_names:
            pose_bone = rig.pose.bones[name]
            current = continuous_quaternion(
                pose_bone.rotation_quaternion.copy(), previous_quaternions.get(name)
            )
            pose_bone.rotation_quaternion = current
            previous_quaternions[name] = current.copy()
            pose_bone.keyframe_insert("rotation_quaternion", frame=frame, group=name)
            pose_bone.keyframe_insert("location", frame=frame, group=name)
            pose_bone.keyframe_insert("scale", frame=frame, group=name)

        bpy.context.view_layer.update()
        body_turn = body["root_yaw"] + body["torso_yaw"] + body["head_yaw"]
        records.append(
            {
                "frame": frame,
                "time": round(time, 6),
                "root_turn_degrees": round(body["root_yaw"], 4),
                "torso_turn_degrees": round(body["torso_yaw"], 4),
                "head_turn_degrees": round(body["head_yaw"], 4),
                "approx_head_world_turn_degrees": round(body_turn, 4),
                "grip_gltf": {
                    side: [
                        float(rig.pose.bones[f"Grip_{side}"].head.x),
                        float(rig.pose.bones[f"Grip_{side}"].head.z),
                        float(-rig.pose.bones[f"Grip_{side}"].head.y),
                    ]
                    for side in ("L", "R")
                },
            }
        )

    action["loop"] = False
    action["duration_seconds"] = PULL_DURATION
    set_linear_interpolation(action)
    return {"duration_seconds": PULL_DURATION, "fps": FPS, "positions": records}
