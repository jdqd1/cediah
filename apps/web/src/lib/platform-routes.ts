/** Routes that already use the shared application chrome. Standalone course
 * pages and the video laboratory retain their own header and layout. */
export function isPlatformPath(pathname: string) {
  return pathname === "/cursos" || /^\/(dashboard|asignaturas|contenido|guias|panel|biblioteca|clases)(\/|$)/.test(pathname);
}
