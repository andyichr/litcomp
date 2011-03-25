#!/usr/bin/env perl

use FileHandle;
use IPC::Open2;

use JSON;
use Data::Dumper;

use strict;

my @input = <STDIN>;
my $req = from_json( join( "", @input ) );

my $error = sub {
	my $message = shift;
	print STDERR "ERROR: $message";
	print STDERR "\n";
	exit 1;
};

my $realize; $realize = sub {
	my $take = shift;

	my $res;

	if ( $take->{this} ) {
		$res->{to} = $take->{from};
		$res->{json} = to_json( $take->{this} );
	} else {
		if ( $take->{take} ) {
			$res = $realize->( $take->{take} );
		} else {
			$error->( "missing \"this\" or \"take\"" );
		}
	}

	# search for correct arrow to apply to value
	my $from = $take->{from};
	my $to = $take->{to};
	my $using = $take->{using};

	if ( $res->{to} ne $from ) {
		$error->( "type error: \"" . $res->{to} . "\" != \"" . $from . "\"" );
	}

	my @path = split ( ":", $ENV{PATH} );
	my $found_arrow = 0;

	foreach ( @path ) {
		my $base_dir = $_;
		my $arrow_bin = $base_dir . "/" . $from . "/" . $to . "/" . $using;

		if ( -e $arrow_bin ) {
			$found_arrow = 1;
			my $pid = open2( *Reader, *Writer, "\"$arrow_bin\"" );
			print Writer $res->{json};
			close( Writer );
			my @process_stdout = <Reader>;
			close( Reader );
			$res->{json} = join( "", @process_stdout );
			last;
		}
	}

	if ( !$found_arrow ) {
		$error->( "arrow not found: $using : $from -> $to" );
	}

	$res->{to} = $take->{to};
	return $res;
};

if ( $req->{take} ) {
	print $realize->( $req->{take} )->{json};
}
