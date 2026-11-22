"""Usage: bpy-python build_web_pull.py SOURCE.blend ORIGINAL.glb OUTPUT_DIRECTORY

Bake a 4.2s web-assisted pull. Merge ONLY its animation buffers into the original
GLB: geometry, skin weights, textures, materials and rest transforms stay exact.
The source BLEND is never overwritten. Output includes an editable BLEND.
"""
import copy
import json
import math
import struct
import sys
from pathlib import Path
import bpy
from mathutils import Matrix, Vector
import rig_animation_tools as rigtools

DURATION = 4.2
FPS = 60

def curve(points, t):
    """Shape-preserving cubic Hermite: continuous velocity through waypoints."""
    if t <= points[0][0]: return points[0][1]
    if t >= points[-1][0]: return points[-1][1]
    n = len(points)
    slopes = [(points[i+1][1]-points[i][1])/(points[i+1][0]-points[i][0]) for i in range(n-1)]
    tangents = [0.0]
    for i in range(1,n-1):
        a,b = slopes[i-1],slopes[i]
        h0,h1 = points[i][0]-points[i-1][0],points[i+1][0]-points[i][0]
        w0,w1=2*h1+h0,h1+2*h0
        tangents.append((w0+w1)/(w0/a+w1/b) if a*b>0 else 0.0)
    tangents.append(0.0)
    i = next(i for i in range(n-1) if t <= points[i+1][0])
    dt=points[i+1][0]-points[i][0];u=(t-points[i][0])/dt
    return (2*u**3-3*u*u+1)*points[i][1]+(u**3-2*u*u+u)*dt*tangents[i]+(-2*u**3+3*u*u)*points[i+1][1]+(u**3-u*u)*dt*tangents[i+1]

def body_pose(t):
    c=lambda keys:curve(keys,t)
    return dict(
        root_yaw=c([(0,0),(.35,-2),(.88,4),(1.32,-2),(2.8,-3),(3.6,1),(4.2,0)]),
        torso_yaw=c([(0,0),(.3,-4),(.86,9),(1.2,-5),(1.55,2),(2.75,-5),(3.5,1.2),(4.2,0)]),
        head_yaw=c([(0,0),(.3,12),(.72,6),(1.05,-10),(1.45,0),(2.5,-4),(3.25,2),(4.2,0)]),
        torso_pitch=c([(0,0),(.32,-2),(.95,3),(1.35,2),(2.6,-7),(2.9,-8),(3.4,1.4),(4.2,0)]),
        head_pitch=c([(0,0),(.48,-8),(.98,-10),(1.4,-5),(2.7,4),(3.35,-1.5),(4.2,0)]),
        torso_roll=c([(0,0),(.7,-1.5),(1.6,1),(2.85,1.4),(3.5,-.5),(4.2,0)]),
        head_roll=c([(0,0),(.65,2),(1.5,.7),(2.8,-1.5),(3.5,.4),(4.2,0)]),
        root_location=Vector((c([(0,0),(.7,-.035),(1.3,.015),(2.8,.06),(3.5,-.015),(4.2,0)]),0,
            c([(0,0),(.35,-.025),(.95,.025),(1.4,0),(2.8,-.17),(3.4,.018),(4.2,0)]))))

def anchors(rig,side):
    hand=rig.data.bones['Hand_'+side]
    long_axis=(rig.data.bones['Middle_01_'+side].head_local-hand.head_local).normalized()
    lateral=(rig.data.bones['Index_01_'+side].head_local-rig.data.bones['Pinky_01_'+side].head_local).normalized()
    palm=long_axis.cross(lateral).normalized()*(1 if side=='L' else -1)
    hinge=hand.matrix_local.to_quaternion().inverted() @ long_axis.cross(palm).normalized()
    return dict(rig=rig,rest=hand.head_local.copy(),hinge=hinge)

def arm_pose(data, side, t):
    sign=1 if side=='L' else -1
    # Separate casts, then converge into one weighted pull. Recovery is shared.
    t-=.16*rigtools.ease(t,0,.3)*(1-rigtools.ease(t,1.3,2)) if side=='R' else 0
    rest=data['rest']; rig=data['rig']
    times=[0,.2,.62,.94,1.24,1.55,2.15,2.8,3.05,3.5,4.05]
    positions=[rest, rest+Vector((sign*.05,-.06,.05)),
        Vector((sign*1.25,-1.2,7.6)),Vector((sign*1.45,-1.9,8.9)),
        Vector((sign*1.45,-1.88,8.86)),Vector((sign*1.42,-1.82,8.65)),
        Vector((sign*1.25,-1.2,7.6)),Vector((sign*1.12,-.8,5.85)),
        Vector((sign*1.24,-.7,5.7)),rest+Vector((sign*.12,-.15,.03)),rest]
    if side=='R':
        for i in range(2,6):positions[i]+=Vector((-.08,-.02,-.1))
    wrist=Vector([curve(list(zip(times,[p[a] for p in positions])),t) for a in range(3)])
    clav=curve([(0,0),(.55,2),(.98,6.5),(1.4,6),(2.3,2),(2.95,0),(4.2,0)],t)
    # Stable lateral elbow plane avoids IK pole crossings and wrist flips.
    tuck=rigtools.ease(t,.55,.92)*(1-rigtools.ease(t,1.65,2.32))
    pole=Vector((sign*.9,.25,-.28)).lerp(Vector((sign*.35,-.4,-1)),tuck)
    solved=rigtools.solve_arm(rig,side,wrist,pole,clav)
    envelope=rigtools.ease(t,.1,.65)*(1-rigtools.ease(t,3.15,4.05))
    result={name:rigtools.interpolate_basis(Matrix.Identity(4),basis,envelope) for name,basis in solved.items()}
    # Wrist extension is a hinge bend, never an imposed world-space palm twist.
    extension=24*rigtools.ease(t,.55,.92)*(1-rigtools.ease(t,1.25,1.75))
    extension+=7*rigtools.ease(t,1.25,1.75)*(1-rigtools.ease(t,2.8,3.3))
    result['Hand_'+side] @= Matrix.Rotation(math.radians(-extension),4,data['hinge'])
    return result

def finger_grip(t,finger,side):
    t-=.16*rigtools.ease(t,0,.3)*(1-rigtools.ease(t,1.3,2)) if side=='R' else 0
    shoot=rigtools.ease(t,.45,.88)*(1-rigtools.ease(t,1.12,1.48))
    grip=rigtools.ease(t,1.12,1.48)*(1-rigtools.ease(t,2.82,3.35))
    return shoot*({'Middle':.9,'Ring':.9,'Thumb':.25}.get(finger,.04)) + .9*grip

def read_glb(path):
    blob=Path(path).read_bytes();length=struct.unpack_from('<I',blob,12)[0]
    doc=json.loads(blob[20:20+length]);pos=20+length
    size=struct.unpack_from('<I',blob,pos)[0]
    return doc,blob[pos+8:pos+8+size]

def write_glb(path,doc,binary):
    # Keep meshopt's virtual fallback buffer and its extension metadata.
    doc['buffers'][0]['byteLength']=len(binary)
    data=json.dumps(doc,separators=(',',':')).encode();data+=b' '*((-len(data))%4)
    binary+=b'\0'*((-len(binary))%4)
    Path(path).write_bytes(struct.pack('<III',0x46546c67,2,28+len(data)+len(binary))+struct.pack('<II',len(data),0x4e4f534a)+data+struct.pack('<II',len(binary),0x004e4942)+binary)

def merge_animation(original, exported, target):
    doc,blob=read_glb(original); new,data=read_glb(exported)
    clip=copy.deepcopy(next(a for a in new['animations'] if a['name']=='PullShutter'))
    nodes={node.get('name'):i for i,node in enumerate(doc['nodes'])}
    copied={}
    for sampler in clip['samplers']:
        for prop in ('input','output'):
            old=sampler[prop]
            if old not in copied:
                acc=copy.deepcopy(new['accessors'][old]);view=copy.deepcopy(new['bufferViews'][acc['bufferView']])
                assert not view.get('extensions') and not acc.get('sparse')
                blob+=b'\0'*((-len(blob))%4)
                start=view.get('byteOffset',0);chunk=data[start:start+view['byteLength']]
                view['byteOffset']=len(blob);view['buffer']=0;blob+=chunk
                acc['bufferView']=len(doc['bufferViews']);doc['bufferViews'].append(view)
                copied[old]=len(doc['accessors']);doc['accessors'].append(acc)
            sampler[prop]=copied[old]
    for channel in clip['channels']:
        channel['target']['node']=nodes[new['nodes'][channel['target']['node']]['name']]
    doc['animations']=[clip if a['name']=='PullShutter' else a for a in doc['animations']]
    write_glb(target,doc,blob)
    source,_=read_glb(original)
    for field in ('nodes','meshes','skins','materials','textures','images'):
        assert doc[field]==source[field],f'Visual data changed: {field}'
    return {'exact_visual_data_preserved':True,'duration_seconds':DURATION,'bytes':Path(target).stat().st_size}

def main():
    source,original,out=map(Path,sys.argv[1:4]);out.mkdir(parents=True,exist_ok=True)
    if (out/'mascot_web_pull.blend').resolve()==source.resolve() or (out/'mascot_web_pull.glb').resolve()==original.resolve():
        raise ValueError('Use a separate output directory; source assets must remain as backups.')
    bpy.ops.wm.open_mainfile(filepath=str(source.resolve()))
    rig=bpy.data.objects['Mascot_Rig'];rigtools.reset_pose(rig)
    before=rigtools.immutable_scene_signature()
    rigtools.body_pose=body_pose;rigtools.build_arm_anchors=anchors
    rigtools.arm_basis_at=arm_pose;rigtools.finger_grip=finger_grip
    rigtools.FPS=FPS;rigtools.PULL_DURATION=DURATION;rigtools.PULL_END_FRAME=round(FPS*DURATION)
    rigtools.create_pull_shutter(rig)
    action=bpy.data.actions['PullShutter']
    for key in list(action.keys()):del action[key]
    action['duration_seconds']=DURATION;action['pull_start_seconds']=1.4;action['pull_end_seconds']=2.85
    rigtools.reset_pose(rig)
    assert before==rigtools.immutable_scene_signature(),'Rest asset modified'
    scene=bpy.context.scene;scene.render.fps=FPS;scene.frame_start=0;scene.frame_end=252
    bpy.ops.wm.save_as_mainfile(filepath=str((out/'mascot_web_pull.blend').resolve()))
    # Animation export is temporary; merge only the new clip into original GLB.
    bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
    for obj in scene.objects:
        if obj.type=='MESH' and obj.name!='Icosphere':obj.select_set(True)
    bpy.context.view_layer.objects.active=rig
    raw=out/'animation_export.glb'
    bpy.ops.export_scene.gltf(filepath=str(raw.resolve()),export_format='GLB',use_selection=True,
        export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=False,
        export_frame_range=False,export_anim_slide_to_zero=True,export_optimize_animation_size=False,
        export_skins=True,export_def_bones=True,export_leaf_bone=False,export_morph=False,
        export_cameras=False,export_lights=False,export_meshopt_compression_enable=False)
    report=merge_animation(original,raw,out/'mascot_web_pull.glb')
    report['source_blend_unchanged']=True
    (out/'report.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report),flush=True)

if __name__=='__main__':main()
