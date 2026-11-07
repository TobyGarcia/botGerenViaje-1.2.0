// Compartido por el service worker y sus pruebas. No depende de una ventana abierta.
globalThis.GvMovementSync = {
  async run(job, io) {
    let server = Number(job.serverId);
    if (job.bootstrap) {
      const { finishedAt, cancelledAt, kilometrajeFinal, ...start } = job.bootstrap;
      const result = await io.post('/api/viajes/offline/sincronizar', start);
      server = Number(result.data.idViaje);
      await io.mapped(server);
    }
    if (!Number.isSafeInteger(server) || server <= 0) throw new Error('El inicio del viaje espera sincronización.');
    for (const operation of job.operations) {
      await io.post(`/api/viajes/${server}/elementos/eventos`, operation);
      await io.ackMovement(operation.eventKey);
    }
    if (await io.pendingMovements()) throw new Error('Hay movimientos nuevos pendientes.');
    for (let batch = 0; batch < 10; batch++) {
      const { points, rejected } = await io.gps();
      if (rejected) throw new Error('Hay ubicaciones para revisión.');
      if (!points.length) break;
      const result = (await io.post(`/api/viajes/${server}/ubicaciones/lote`, { ubicaciones: points })).data;
      const invalid = result.idsRechazados || [];
      const known = new Set(points.map(point => point.clientLocationId));
      if (!Array.isArray(invalid) || result.rechazadas !== invalid.length ||
          result.insertadas + result.duplicadas + invalid.length !== points.length || invalid.some(id => !known.has(id))) throw new Error('Lote GPS sin confirmación completa.');
      await io.ackGps([...known].filter(id => !invalid.includes(id)), invalid);
    }
    const remaining = await io.gps();
    if (remaining.points.length || remaining.rejected || await io.pendingMovements()) throw new Error('Quedan datos antes del cierre.');
    if (job.bootstrap?.finishedAt || job.bootstrap?.cancelledAt) {
      await io.post('/api/viajes/offline/sincronizar', job.bootstrap);
    } else if (job.completion) {
      await io.post(`/api/viajes/${server}/cierre-nativo`, job.completion);
    }
    return server;
  }
};
