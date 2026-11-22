"""Clean-import validation and render checkpoints. bpy-python SCRIPT model.glb OUT"""
import json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector

source,out=map(Path,sys.argv[1:3]);out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps=60
bpy.ops.import_scene.gltf(filepath=str(source.resolve()))
scene=bpy.context.scene;scene.render.fps=60
rig=next(o for o in scene.objects if o.type=='ARMATURE')
rig.animation_data_create();action=bpy.data.actions['PullShutter']
rig.animation_data.action=action
if action.slots:rig.animation_data.action_slot=action.slots[0]
hinges={}
previous={};max_delta=0;max_scale_error=0;max_hand_bend=0
names=['Root','Torso','Head']+[f'{part}_{s}' for s in ['L','R'] for part in ['Clavicle','Arm','Forearm','Hand']]
for frame in range(253):
    scene.frame_set(frame);bpy.context.view_layer.update()
    for name in names:
        bone=rig.pose.bones[name];q=bone.rotation_quaternion.copy()
        max_scale_error=max(max_scale_error,max(abs(v-1) for v in bone.scale))
        if name in previous:
            angle=2*math.acos(min(1,abs(q.dot(previous[name]))))
            if math.degrees(angle)>max_delta:
                max_delta=math.degrees(angle);worst=(frame,name)
        previous[name]=q
        if name.startswith('Hand'):
            max_hand_bend=max(max_hand_bend,math.degrees(q.angle))
            if math.degrees(q.angle)>1:
                axis=q.axis.normalized()
                if name in hinges:assert abs(axis.dot(hinges[name]))>.999, f'Wrist hinge acquired twist: {name}'
                hinges[name]=axis.copy()
assert max_delta<18,f'Joint discontinuity: {max_delta}, {worst}'
assert max_scale_error<1e-4,f'Unexpected scaling: {max_scale_error}'
assert max_hand_bend<25,f'Excessive wrist bend: {max_hand_bend}'
report={'frames_checked':253,'max_joint_degrees_per_frame':max_delta,'max_scale_error':max_scale_error,'max_wrist_bend_degrees':max_hand_bend,'clips':list(bpy.data.actions.keys())}
(out/'validation.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)

def aim(obj,point):obj.rotation_euler=(Vector(point)-obj.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=520;scene.render.resolution_y=620;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Preview world')
scene.render.image_settings.file_format='PNG';scene.world.color=(.7,.7,.7)
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.7,.72,.74,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
bpy.ops.object.camera_add(location=(0,-15,7.9));scene.camera=bpy.context.object
scene.camera.data.type='ORTHO';scene.camera.data.ortho_scale=6.2;aim(scene.camera,(0,0,7.9))
for loc,energy,size in [((-6,-8,12),1200,5),((6,-5,9),1000,5),((0,5,10),1500,4)]:
    bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.data.energy=energy;light.data.shape='DISK';light.data.size=size;aim(light,(0,0,8))
for t in [0,.6,1.05,1.85,2.65,3.25,4.2]:
    scene.frame_set(round(t*60));scene.render.filepath=str((out/f'pose_{t:.2f}.png').resolve())
    bpy.ops.render.render(write_still=True)
