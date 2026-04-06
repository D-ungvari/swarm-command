/** Remove collinear waypoints to smooth paths */
export function simplifyPath(path: Array<[number, number]>): Array<[number, number]> {
  if (path.length <= 2) return path;
  const result: Array<[number, number]> = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const [px, py] = result[result.length - 1];
    const [cx, cy] = path[i];
    const [nx, ny] = path[i + 1];
    if (Math.abs((cx - px) * (ny - cy) - (cy - py) * (nx - cx)) > 0.01) {
      result.push(path[i]);
    }
  }
  result.push(path[path.length - 1]);
  return result;
}
