var AppleToo = function() {
  // Memory is stored as numbers
  // See: http://jsperf.com/tostring-16-vs-parseint-x-16
  this.memory = [];
  this.AC = 0; // Registers
  this.XR = 0;
  this.YR = 0;
  this.SR = 0;
  this.SP;
  this.PC = 0xC000;

  this.running = true;

  this.cycles = 0;

  this.initialize_memory();
};

AppleToo.prototype.run6502 = function(program, pc) {
  this.running = true;
  this.PC = pc === undefined ? 0xC000 : pc;
  var opcode;

  this.program = program.replace(/\s+/g, "");

  for (var i = 0; i < this.program.length; i += 2) {
    this.memory[0xC000 + i/2] = parseInt(this.program.substr(i, 2), 16);
  }

  while (this.running) {
    this.run(this._read_memory(this.PC++));
  }

  //this.print_registers();
};

AppleToo.prototype.run = function(opcode) {
  return OPCODES[opcode].call(this);
};

AppleToo.prototype.immediate = function() {
  return this.PC++;
};
//implied addressing mode function unnecessary
AppleToo.prototype.accumulator = function() {
  return this.AC;
};
AppleToo.prototype.relative = function() {
  return this.PC + unsigned_to_signed(this._read_memory(this.PC++));
};
AppleToo.prototype.zero_page = function() {
  if (this._read_memory(this.PC) > 0xFF) throw new Error("Zero_Page boundary exceeded");
  return this._read_memory(this.PC++);
};
AppleToo.prototype.zero_page_indexed_with_x = function() {
  var addr = this._read_memory(this.PC++) + this.XR;
  if (addr > 0xFF) throw new Error("Zero_Page boundary exceeded");
  return addr;
};
AppleToo.prototype.zero_page_indexed_with_y = function() {
  var addr = this._read_memory(this.PC++) + this.YR;
  if (addr > 0xFF) throw new Error("Zero_Page boundary exceeded");
  return addr;
};
AppleToo.prototype.absolute = function() {
  var addr = this.read_word(this.PC);
  this.PC += 2;
  return addr;
};
AppleToo.prototype.absolute_indexed_with_x = function() {
  var addr = this.read_word(this.PC) + this.XR;
  this.PC += 2;
  return addr;
};
AppleToo.prototype.absolute_indexed_with_y = function() {
  var addr = this.read_word(this.PC) + this.YR;
  this.PC += 2;
  return addr;
};
AppleToo.prototype.absolute_indirect = function() {
  var addr = this.read_word(this.PC);
  addr = this.read_word(addr);
  this.PC += 2;
  return addr;
};
AppleToo.prototype.zero_page_indirect_indexed_with_x = function() {
  var addr = this._read_memory(this.PC++);
  if (addr > 0xFF) throw new Error("Zero_Page boundary exceeded");

  addr = (addr + this.XR) % 255;
  return this.read_word(addr);
};
AppleToo.prototype.zero_page_indirect_indexed_with_y = function() {
  var addr = this._read_memory(this.PC++);
  if (addr > 0xFF) throw new Error("Zero_Page boundary exceeded");

  addr = (addr + this.YR) % 255;
  return this.read_word(addr);
};

AppleToo.prototype.print_registers = function() {
  console.log("--------------");
  console.log("AC: " + this.AC);
  console.log("XR: " + this.XR);
  console.log("YR: " + this.YR);
  console.log("SR: " + this.SR);
  console.log("SP: " + this.SP);
  console.log("PC: " + this.PC);
  console.log("--------------");
};

AppleToo.prototype.initialize_memory = function() {
  for (var i=0; i<65536; i++) {
    this.memory[i] = 0;
  }
};

AppleToo.prototype.read_memory = function(loc, word) {
  if (typeof loc === "string") {
    loc = parseInt(loc, 16);
  }
  if (word !== undefined) {
    return (this.memory[loc + 1].toString(16) + this.memory[loc].toString(16)).toString(16);
  }
  return this.memory[loc].toString(16).toUpperCase();
};

AppleToo.prototype._read_memory = function(loc) {
  return this.memory[loc];
};

AppleToo.prototype.write_memory = function(loc, val) {
  if (typeof loc === "string") loc = parseInt(loc, 16);
  if (typeof val === "string") val = parseInt(val, 16);

  if (val <= 255) {
    this.memory[loc] = val;
  } else {
    console.log(val);
    throw new Error("ERROR: Tried to write more than a word!");
  }
};

// Internally, data in memory is numbers, not strings.
AppleToo.prototype._write_memory = function(loc, val) {
  if (typeof loc === "string") {
    loc = parseInt(loc, 16);
  }
  if (val <= 255) {
    this.memory[loc] = val;
  } else if (val <= 65535) {
    var high_byte = val & 65280,
        low_byte = val & 255;
    this.memory[loc] = low_byte;
    this.memory[loc+1] = high_byte;
  } else {
    throw new Error("ERROR: Tried to write more than a word!");
  }
};

AppleToo.prototype.read_word = function(addr) {
 return this._read_memory(addr) + (this._read_memory(addr + 1) << 8);
};

AppleToo.prototype.get_register = function(register) {
  return zero_pad(this[register]);
};

AppleToo.prototype.set_register = function(register, val) {
  if (typeof val === "string") val = parseInt(val, 16);
  return this[register] = val;
};

AppleToo.prototype.get_status_flags = function() {
  var bits = zero_pad(this.SR, 8, 2).split('');
  bits = bits.map(function(item) {
    return parseInt(item, 10);
  });
  return {
    N: bits[0],
    V: bits[1],
    _: bits[2],
    B: bits[3],
    D: bits[4],
    I: bits[5],
    Z: bits[6],
    C: bits[7]
  };
};

AppleToo.prototype.set_status_flags = function(obj) {
  for (var bit in obj) {
    if (obj[bit]) {
      this.SR = this.SR | SR_FLAGS[bit];
    }
  };
};

AppleToo.prototype._ld_register = function(register, addr) {
  // Reset Zero and Negative Flags
  this.SR &= (255 - SR_FLAGS["Z"] - SR_FLAGS["N"]);

  this[register] = this._read_memory(addr);

  //Set negative flag
  this.SR |= this[register] & SR_FLAGS["N"];
  //Set zero flag
  if (this[register] === 0) {
    this.SR |= SR_FLAGS["Z"];
  }

};

AppleToo.prototype.ldy = function(addr) { this._ld_register("YR", addr); };
AppleToo.prototype.ldx = function(addr) { this._ld_register("XR", addr); };
AppleToo.prototype.lda = function(addr) { this._ld_register("AC", addr); };
AppleToo.prototype.stx = function(addr) {
  this._write_memory(addr, this.XR);
};
AppleToo.prototype.sty = function(addr) {
  this._write_memory(addr, this.YR);
};
AppleToo.prototype.sta = function(addr) {
  this._write_memory(addr, this.AC);
};
AppleToo.prototype.adc = function(addr) {
  var result = this.AC + this._read_memory(addr) + (this.SR & SR_FLAGS.C);

  if ((this.AC & SR_FLAGS.N) !== (result & SR_FLAGS.N)) {
    this.SR |= SR_FLAGS.V; //Set Overflow Flag
  } else {
    this.SR &= ~SR_FLAGS.V & 0xFF; //Clear Overflow Flag
  }

  this.SR |= (result & SR_FLAGS.N); //Set Negative Flag
  if (result & SR_FLAGS.N) {
    this.SR |= SR_FLAGS.N;
  } else {
    this.SR &= ~SR_FLAGS.N & 0xFF;
  }

  if (result === 0) {
    this.SR |= SR_FLAGS.Z; //Set Zero Flag
  } else {
    this.SR &= ~SR_FLAGS.Z & 0xFF; //Clear Zero Flag
  }

  if (this.SR & SR_FLAGS.D) {
    result = to_bcd(from_bcd(this.AC) + from_bcd(this._read_memory(addr)) + (this.SR & SR_FLAGS.C));
    if (result > 99) {
      this.SR |= SR_FLAGS.C;
    } else {
      this.SR &= ~SR_FLAGS.C & 0xFF;
    }
  } else {
    if (result > 0xFF) {
      this.SR |= SR_FLAGS.C;
      result &= 0xFF;
    } else {
      this.SR &= ~SR_FLAGS.C & 0xFF;
    }
  }
  this.AC = result;
};
AppleToo.prototype.sbc = function(addr) {
  var result,
      borrow = (this.SR & SR_FLAGS.C) ? 0 : 1;
  if (this.SR & SR_FLAGS.D) {
    result = from_bcd(this.AC) - from_bcd(this._read_memory(addr)) - borrow;
    if (result > 99 || result < 0) {
      this.SR |= SR_FLAGS.V; // Set overflow
    } else {
      this.SR &= ~SR_FLAGS.V & 0xFF; // Clear overflow
    }
    result = to_bcd(result);
  } else {
    result = this.AC - this._read_memory(addr) - borrow;
    if (result > 0x7F) {
      this.SR |= SR_FLAGS.V; // Set overflow
    } else {
      this.SR &= ~SR_FLAGS.V & 0xFF; // Clear overflow
    }
  }

  console.log("result ", result);
  if (result > 0x7F) {
    this.SR |= SR_FLAGS.C; // Set carry
  } else {
    this.SR &= ~SR_FLAGS.C & 0xFF; // Clear carry
  }

  if (result & SR_FLAGS.N) {
    this.SR |= SR_FLAGS.N;
  } else {
    this.SR &= ~SR_FLAGS.N & 0xFF;
  }

  if (result === 0) {
    this.SR |= SR_FLAGS.Z; //Set Zero Flag
  } else {
    this.SR &= ~SR_FLAGS.Z & 0xFF; //Clear Zero Flag
  }

  this.AC = result;
};

AppleToo.prototype.brk = function() {
  this.running = false; //TODO Implement properly!
};

var OPCODES = {
  0xA0 : function() { this.ldy(this.immediate()); this.cycles += 2; },
  0xA4 : function() { this.ldy(this.zero_page()); this.cycles += 3; },
  0xB4 : function() { this.ldy(this.zero_page_indexed_with_x()); this.cycles += 4; },
  0xAC : function() { this.ldy(this.absolute()); this.cycles += 4; },
  0xBC : function() { this.ldy(this.absolute_indexed_with_x()); this.cycles += 4; },
  0xA2 : function() { this.ldx(this.immediate()); this.cycles += 2; },
  0xA6 : function() { this.ldx(this.zero_page()); this.cycles += 3; },
  0xB6 : function() { this.ldx(this.zero_page_indexed_with_y()); this.cycles += 4; },
  0xAE : function() { this.ldx(this.absolute()); this.cycles += 4; },
  0xBE : function() { this.ldx(this.absolute_indexed_with_y()); this.cycles += 4; },
  0xA9 : function() { this.lda(this.immediate()); this.cycles += 2; },
  0xA5 : function() { this.lda(this.zero_page()); this.cycles += 3; },
  0xB5 : function() { this.lda(this.zero_page_indexed_with_x()); this.cycles += 4; },
  0xAD : function() { this.lda(this.absolute()); this.cycles += 4; },
  0xBD : function() { this.lda(this.absolute_indexed_with_x()); this.cycles += 4; },
  0xB9 : function() { this.lda(this.absolute_indexed_with_y()); this.cycles += 4; },
  0xA1 : function() { this.lda(this.zero_page_indirect_indexed_with_x()); this.cycles += 6; },
  0xB1 : function() { this.lda(this.zero_page_indirect_indexed_with_y()); this.cycles += 6; },
  0x86 : function() { this.stx(this.zero_page()); this.cycles += 3; },
  0x96 : function() { this.stx(this.zero_page_indexed_with_y()); this.cycles += 4; },
  0x8E : function() { this.stx(this.absolute()); this.cycles += 4; },
  0x84 : function() { this.sty(this.zero_page()); this.cycles += 3; },
  0x94 : function() { this.sty(this.zero_page_indexed_with_x()); this.cycles += 4; },
  0x8C : function() { this.sty(this.absolute()); this.cycles += 4; },
  0x85 : function() { this.sta(this.zero_page()); this.cycles += 3; },
  0x95 : function() { this.sta(this.zero_page_indexed_with_x()); this.cycles += 4; },
  0x8D : function() { this.sta(this.absolute()); this.cycles += 4; },
  0x9D : function() { this.sta(this.absolute_indexed_with_x()); this.cycles += 5; },
  0x99 : function() { this.sta(this.absolute_indexed_with_y()); this.cycles += 5; },
  0x81 : function() { this.sta(this.zero_page_indirect_indexed_with_x()); this.cycles += 6; },
  0x91 : function() { this.sta(this.zero_page_indirect_indexed_with_y()); this.cycles += 6; },
  0x00 : function() { this.brk(); }
};

var SR_FLAGS = {
  "N" : 128,
  "V" : 64,
  "_" : 32,
  "B" : 16,
  "D" : 8,
  "I" : 4,
  "Z" : 2,
  "C" : 1
};

// Utilities
function zero_pad(n, len, base) {
  len = len || 2;
  base = base || 16;
  var result = n.toString(base).toUpperCase();
  while (result.length < len) {
    result = "0" + result;
  }
  return result;
}

function unsigned_to_signed(val) {
  if (val > 255) throw new Error("unsigned_to_signed only works on 1 byte numbers");
  if (val < 128) return val;
  return (val - 256);
}

function from_bcd(val) {
  var high = (val & 0xF0) >> 4,
      low = val & 0x0F;
  return high * 10 + low;
}

function to_bcd(val) {
  if (val > 99 || val < 0) throw new Error("Bad BCD Value");
  if (val < 10) return val;

  var digits = val.toString().split("");

  return ((parseInt(digits[0],10)<<4) + parseInt(digits[1],10)) & 0xFF;
}
// vim: expandtab:ts=2:sw=2
