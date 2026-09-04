export type DiagramObject = {
  id: string;
  modelId: string;
  type: 'actor' | 'app' | 'component' | 'store' | 'system' | 'group';
  shape: 'box' | 'area';
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DiagramConnection = {
  id: string;
  modelId: string;
  originId: string;
  targetId: string;
  originConnector: 'right-middle' | 'left-middle' | 'bottom-center' | 'top-center';
  targetConnector: 'right-middle' | 'left-middle' | 'bottom-center' | 'top-center';
  lineShape: 'curved' | 'straight' | 'square';
  labelPosition: number;
  points: Array<{ x: number; y: number }>;
};

export function dobj(
  id: string,
  modelId: string,
  type: DiagramObject['type'],
  x: number,
  y: number,
  width = 180,
  height = 90
): DiagramObject {
  return { id, modelId, type, shape: 'box', x, y, width, height };
}

function anchor(
  obj: DiagramObject,
  connector: DiagramConnection['originConnector']
): { x: number; y: number } {
  switch (connector) {
    case 'left-middle':
      return { x: obj.x, y: obj.y + obj.height / 2 };
    case 'right-middle':
      return { x: obj.x + obj.width, y: obj.y + obj.height / 2 };
    case 'top-center':
      return { x: obj.x + obj.width / 2, y: obj.y };
    case 'bottom-center':
      return { x: obj.x + obj.width / 2, y: obj.y + obj.height };
  }
}

export function dconn(
  objects: Record<string, DiagramObject>,
  modelConnectionId: string,
  originDiagramId: string,
  targetDiagramId: string,
  originConnector: DiagramConnection['originConnector'] = 'right-middle',
  targetConnector: DiagramConnection['targetConnector'] = 'left-middle',
  options: { bend?: number } = {}
): DiagramConnection {
  const origin = objects[originDiagramId];
  const target = objects[targetDiagramId];
  if (!origin || !target) {
    throw new Error(`Missing diagram object for connection ${modelConnectionId}`);
  }
  const from = anchor(origin, originConnector);
  const to = anchor(target, targetConnector);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const bend = options.bend ?? 48;
  const mid = {
    x: (from.x + to.x) / 2 + (-dy / len) * bend,
    y: (from.y + to.y) / 2 + (dx / len) * bend
  };

  return {
    id: modelConnectionId,
    modelId: modelConnectionId,
    originId: originDiagramId,
    targetId: targetDiagramId,
    originConnector,
    targetConnector,
    lineShape: 'curved',
    labelPosition: 0.5,
    points: [from, mid, to]
  };
}
